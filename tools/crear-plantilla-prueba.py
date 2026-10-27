"""Crea la plantilla de revisión sin modificar el original ni la aplicación."""
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Modelo  listado v(1.4).xlsx'
TARGET = ROOT / 'Modelo  listado v(1.5)-prueba.xlsx'
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('', NS)


def element(tag, attributes=None, text=None):
    node = ET.Element(f'{{{NS}}}{tag}', attributes or {})
    node.text = text
    return node


def xml(node):
    return ET.tostring(node, encoding='unicode')


with zipfile.ZipFile(SOURCE) as source:
    files = {item.filename: source.read(item.filename) for item in source.infolist()}

styles = files['xl/styles.xml'].decode('utf-8')
styles_tree = ET.fromstring(styles)
dxfs = styles_tree.find(f'{{{NS}}}dxfs')
first_style = len(dxfs)
new_styles = []
for background, foreground in [
    ('FFCC0000', 'FFFFFFFF'),
    ('FFFFE699', 'FF000000'),
    ('FFCC0000', 'FFFFFFFF'),
]:
    dxf = element('dxf')
    font = element('font')
    font.append(element('color', {'rgb': foreground}))
    dxf.append(font)
    fill = element('fill')
    pattern = element('patternFill', {'patternType': 'solid'})
    pattern.append(element('fgColor', {'rgb': background}))
    pattern.append(element('bgColor', {'rgb': background}))
    fill.append(pattern)
    dxf.append(fill)
    new_styles.append(xml(dxf))
styles = re.sub(r'(<dxfs\b[^>]*count=")\d+("[^>]*>)',
                lambda m: m[1] + str(first_style + 3) + m[2], styles, count=1)
styles = styles.replace('</dxfs>', ''.join(new_styles) + '</dxfs>')
files['xl/styles.xml'] = styles.encode('utf-8')

sheet = files['xl/worksheets/sheet1.xml'].decode('utf-8')
# Deja las reglas nuevas por delante de los colores existentes de familia.
sheet = re.sub(r'priority="(\d+)"', lambda m: f'priority="{int(m[1]) + 5}"', sheet)
rules = []


def highlight(area, formula, style):
    conditional = element('conditionalFormatting', {'sqref': area})
    rule = element('cfRule', {'type': 'expression', 'dxfId': str(style),
                             'priority': str(len(rules) + 1), 'stopIfTrue': '1'})
    rule.append(element('formula', text=formula))
    conditional.append(rule)
    rules.append(xml(conditional))


# COUNTIF ignora mayúsculas. Escapa sus comodines para comparar documentos literales.
criterion = 'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(E2,"~","~~"),"*","~*"),"?","~?")'
highlight('E2:E2999', f'AND(LEN(TRIM(E2&""))>0,COUNTIF($E$2:$E$2999,{criterion})>1)', first_style)
highlight('E2:E2999', 'IFERROR(AND(LEN(TRIM(E2&""))=0,ISNUMBER(G2),G2>18),FALSE)', first_style + 1)

validations = element('dataValidations', {'count': '3'})
for column, minimum, maximum, message in [
    ('F', 'DATE(1900,1,1)', 'TODAY()', 'Nacimiento: desde 01/01/1900 hasta hoy.'),
    ('H', 'EDATE(TODAY(),-36)', 'TODAY()', 'Derivación: desde hace 3 años hasta hoy.'),
    ('I', 'EDATE(TODAY(),-12)', 'EDATE(TODAY(),48)', 'Vigencia: desde hace 1 año hasta dentro de 4 años.'),
]:
    cell = f'{column}2'
    valid = f'AND(ISNUMBER({cell}),{cell}=INT({cell}),{cell}>={minimum},{cell}<={maximum})'
    highlight(f'{column}2:{column}2999',
              f'AND({cell}<>"",NOT(IFERROR({valid},FALSE)))', first_style + 2)
    validation = element('dataValidation', {
        'type': 'custom', 'allowBlank': '1', 'errorStyle': 'stop',
        'showInputMessage': '1', 'showErrorMessage': '1',
        'promptTitle': 'Fecha en formato dd/mm/aaaa', 'prompt': message,
        'errorTitle': 'Fecha incorrecta', 'error': message + ' Revisa el año y escribe una fecha real.',
        'sqref': f'{column}2:{column}2999',
    })
    validation.append(element('formula1', text=f'OR({cell}="",IFERROR({valid},FALSE))'))
    validations.append(validation)

# El orden OOXML exige formato condicional y validaciones antes de pageMargins.
insert_at = re.search(r'<(?:dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|drawing|extLst)\b', sheet)
if not insert_at:
    raise RuntimeError('No se encontró el punto de inserción en la plantilla.')
sheet = sheet[:insert_at.start()] + ''.join(rules) + xml(validations) + sheet[insert_at.start():]
files['xl/worksheets/sheet1.xml'] = sheet.encode('utf-8')
workbook = files['xl/workbook.xml'].decode('utf-8')
workbook = re.sub(r'<calcPr\b[^>]*/>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>', workbook)
files['xl/workbook.xml'] = workbook.encode('utf-8')

with zipfile.ZipFile(TARGET, 'w', zipfile.ZIP_DEFLATED) as target:
    for path, data in files.items():
        target.writestr(path, data)
print(TARGET)
