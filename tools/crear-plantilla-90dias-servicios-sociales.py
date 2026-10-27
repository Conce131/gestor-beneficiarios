"""Crea una copia con excepción de origen, vigencia aplicada y cabecera fija."""
from io import BytesIO
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as E
from xml.sax.saxutils import quoteattr

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Modelo  listado v(1.5)-auxiliares-resumen-90dias.xlsx'
TARGET = ROOT / 'Modelo  listado v(2.0)-servicios-sociales-90dias.xlsx'
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
N = {'s': NS}
END = 2999


def node(tag, attrs=None, text=None):
    result = E.Element('{' + NS + '}' + tag, attrs or {})
    result.text = text
    return result


def serialize(root, original):
    declarations = dict(value for _, value in E.iterparse(BytesIO(original), events=['start-ns']))
    for prefix, uri in declarations.items():
        E.register_namespace(prefix, uri)
    output = E.tostring(root, encoding='unicode')
    opening = re.match(r'<[^>]+>', output).group()
    extra = ''
    for prefix, uri in declarations.items():
        attr = 'xmlns' + (':' + prefix if prefix else '')
        if not re.search(r'\s' + re.escape(attr) + '=', opening):
            extra += ' ' + attr + '=' + quoteattr(uri)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            + output[:len(opening)-1] + extra + output[len(opening)-1:]).encode()


with zipfile.ZipFile(SOURCE) as source:
    files = {item.filename: source.read(item.filename) for item in source.infolist()}

sheet = E.fromstring(files['xl/worksheets/sheet1.xml'])
summary = E.fromstring(files['xl/worksheets/sheet3.xml'])
styles = E.fromstring(files['xl/styles.xml'])
data = sheet.find('s:sheetData', N)
rows = {int(row.get('r')): row for row in data}


def put(row_number, column, style, text=None, formula=None):
    row = rows.get(row_number)
    if row is None:
        row = node('row', {'r': str(row_number)})
        rows[row_number] = row
        data.append(row)
    ref = f'{column}{row_number}'
    cell = next((c for c in row if c.get('r') == ref), None)
    if cell is None:
        cell = node('c')
        row.append(cell)
    elif column in ('M', 'N', 'O'):
        assert all(cell.find('s:' + tag, N) is None for tag in ('v', 'f', 'is')), ref
    cell.clear()
    cell.attrib.update({'r': ref, 's': str(style)})
    if formula is not None:
        cell.append(node('f', text=formula))
        cell.append(node('v'))
    elif text is not None:
        cell.set('t', 'inlineStr')
        inline = node('is')
        inline.append(node('t', text=text))
        cell.append(inline)


# Distinción visual de resultados calculados y encabezados con texto ajustado.
xfs = styles.find('s:cellXfs', N)
fills = styles.find('s:fills', N)
fill_id = len(fills)
fill = node('fill')
pattern = node('patternFill', {'patternType': 'solid'})
pattern.append(node('fgColor', {'rgb': 'FFE8EEF3'}))
pattern.append(node('bgColor', {'indexed': '64'}))
fill.append(pattern)
fills.append(fill)
fills.set('count', str(len(fills)))


def variant(base, calculated=False, wrap=False):
    xf = E.fromstring(E.tostring(xfs[base]))
    if calculated:
        xf.set('fillId', str(fill_id))
        xf.set('applyFill', '1')
    if wrap:
        alignment = xf.find('s:alignment', N)
        if alignment is None:
            alignment = node('alignment')
            xf.append(alignment)
        alignment.attrib.update({'wrapText': '1', 'vertical': 'center'})
        xf.set('applyAlignment', '1')
    result = len(xfs)
    xfs.append(xf)
    return result


header_style = variant(14, wrap=True)
date_style = variant(19, calculated=True)
alert_style = variant(20, calculated=True)
comment_style = variant(18, wrap=True)
xfs.set('count', str(len(xfs)))

put(1, 'M', header_style, text='Servicios Sociales')
put(1, 'N', header_style, text='Vigencia aplicada')
put(1, 'O', header_style, text=(
    'Comentarios\n'
    'RESUMEN: al superar 90 días desde el vencimiento de la vigencia utilizada, '
    'la familia deja de contar. El día 90 está incluido.\n'
    'SERVICIOS SOCIALES: marcar Sí en el titular. Si no procede de Servicios Sociales, '
    'dejar sin marcar; la vigencia será la fecha de derivación + 3 meses naturales.'))
rows[1].attrib.update({'ht': '120', 'customHeight': '1', 'spans': '1:15'})

for i in range(2, END + 1):
    # Resumen!N identifica el titular sin depender de la vigencia: no hay ciclo.
    family = 'INDEX(Resumen!$N:$N,ROW())'
    origin = f'INDEX($M:$M,{family})'
    referral = f'INDEX($H:$H,{family})'
    formula = (f'IFERROR(IF(OR({family}="",{origin}<>"No"),"",'
               f'IF(AND(ISNUMBER({referral}),{referral}>0),EDATE({referral},3),"")),"")')
    put(i, 'M', 18)
    put(i, 'N', date_style, formula=formula)
    put(i, 'O', comment_style)
    effective = 'INDEX(VigenciasFamilia,ROW())'
    put(i, 'J', alert_style, formula=f'IFERROR(IF(ISNUMBER({effective}),{effective}-TODAY(),""),"")')

# Resumen, citas y su resaltado usan la misma fecha efectiva.
for c in summary.findall('s:sheetData/s:row/s:c', N):
    if re.fullmatch(r'O\d+', c.get('r', '')):
        f = c.find('s:f', N)
        if f is not None and f.text:
            i = re.search(r'\d+', c.get('r')).group()
            family = f'N{i}'
            manual = f'INDEX(Listado!I:I,{family})'
            applied = f'INDEX(Listado!N:N,{family})'
            f.text = (f'IFERROR(IF({family}="","",IF(INDEX(Listado!M:M,{family})="No",'
                      f'IF({applied}=0,"",{applied}),IF({manual}=0,"",{manual}))),"")')
            for value in c.findall('s:v', N):
                value.text = None

cols = sheet.find('s:cols', N)
for col in list(cols):
    if int(col.get('min')) >= 13:
        cols.remove(col)
    elif int(col.get('max')) >= 13:
        col.set('max', '12')
for index, width, style in [(13, 14, 18), (14, 18, date_style), (15, 65, comment_style)]:
    cols.append(node('col', {'min': str(index), 'max': str(index), 'width': str(width),
                             'customWidth': '1', 'style': str(style)}))
cols.append(node('col', {'min': '16', 'max': '25', 'hidden': '1', 'width': '12'}))

view = sheet.find('s:sheetViews/s:sheetView', N)
view.find('s:pane', N).attrib.update({'ySplit': '1', 'topLeftCell': 'A2',
                                    'activePane': 'bottomLeft', 'state': 'frozen'})

validations = sheet.find('s:dataValidations', N)
validation = node('dataValidation', {
    'type': 'list', 'allowBlank': '1', 'showErrorMessage': '1',
    'errorStyle': 'stop', 'errorTitle': 'Origen de la derivación',
    'error': 'Marca Sí si procede de Servicios Sociales. Desmarca si la derivación viene de otro origen.',
    'sqref': f'M2:M{END}'})
validation.append(node('formula1', text='"Sí,No"'))
validations.append(validation)
validations.set('count', str(len(validations)))

for conditional in sheet.findall('s:conditionalFormatting', N):
    for rule in conditional:
        rule.set('priority', str(int(rule.get('priority')) + 4))


def highlight(area, formula, style, priority):
    conditional = node('conditionalFormatting', {'sqref': area})
    rule = node('cfRule', {'type': 'expression', 'dxfId': str(style),
                          'priority': str(priority), 'stopIfTrue': '1'})
    rule.append(node('formula', text=formula))
    conditional.append(rule)
    sheet.insert(list(sheet).index(validations), conditional)


highlight(f'H2:H{END}', 'AND($A2<>"",$M2="Sí",NOT(ISNUMBER(H2)))', 11, 1)
highlight(f'M2:M{END}', 'AND(M2<>"",OR(AND(M2<>"Sí",M2<>"No"),AND(M2="Sí",$A2="")))', 11, 2)
highlight(f'M2:M{END}', 'M2="Sí"', 14, 3)
highlight(f'N2:N{END}', 'AND(N2<>"",IFERROR(INDEX($M:$M,LOOKUP(2,1/($A$2:$A2<>""),ROW($A$2:$A2)))="Sí",FALSE))', 14, 4)


def colnum(cell):
    value = 0
    for letter in re.match('[A-Z]+', cell.get('r')).group():
        value = value * 26 + ord(letter) - 64
    return value


for row in data:
    row[:] = sorted(row, key=colnum)
data[:] = sorted(data, key=lambda r: int(r.get('r')))

workbook = E.fromstring(files['xl/workbook.xml'])
calc = workbook.find('s:calcPr', N)
if calc is None:
    calc = node('calcPr')
    workbook.append(calc)
calc.attrib.update({'calcMode': 'auto', 'fullCalcOnLoad': '1', 'forceFullCalc': '1'})
names = workbook.find('s:definedNames', N)
if names is not None:
    # También repetir la cabecera al imprimir el Listado.
    for defined in list(names):
        if defined.get('name') == '_xlnm.Print_Titles' and defined.get('localSheetId') == '0':
            names.remove(defined)
    names.append(node('definedName', {'name': '_xlnm.Print_Titles', 'localSheetId': '0'}, 'Listado!$1:$1'))

for path, root in [('xl/worksheets/sheet1.xml', sheet),
                   ('xl/worksheets/sheet3.xml', summary),
                   ('xl/styles.xml', styles), ('xl/workbook.xml', workbook)]:
    files[path] = serialize(root, files[path])
files.pop('xl/calcChain.xml', None)
for path, attr in [('[Content_Types].xml', 'PartName'), ('xl/_rels/workbook.xml.rels', 'Target')]:
    root = E.fromstring(files[path])
    for child in list(root):
        if 'calcChain' in child.get(attr, ''):
            root.remove(child)
    files[path] = serialize(root, files[path])

with zipfile.ZipFile(TARGET, 'w', zipfile.ZIP_DEFLATED) as target:
    for path, blob in files.items():
        target.writestr(path, blob)
print(TARGET)
