"""Crea el mensual con Reparto y retira Reparto del trimestral, con copia previa.

Ejecutar una sola vez sobre un trimestral que aún tenga Reparto. No deduce
asistencia mensual/trimestral: el mensual se rellena con los atendidos del mes.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from copy import deepcopy
from shutil import copyfile
from xml.etree import ElementTree as E
import re

ROOT = Path(__file__).resolve().parents[1]
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
NS = {'s': S}
E.register_namespace('', S)
E.register_namespace('r', R)
def q(tag): return '{'+S+'}'+tag
def read(path):
    with ZipFile(path) as z: return {n: z.read(n) for n in z.namelist()}
def xml(files, path): return E.fromstring(files[path])
def put(files, path, root):
    # Los prefijos de extensiones los declara el serializador. Quitar listas de
    # prefijos antiguos y rutas locales de Excel que ya no se usan.
    for el in root.iter(): el.attrib.pop('{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable', None)
    for parent in root.iter():
        for child in list(parent):
            if child.tag == '{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent': parent.remove(child)
    files[path] = E.tostring(root, encoding='utf-8', xml_declaration=True)
def save(path, files):
    with ZipFile(path, 'w', ZIP_DEFLATED) as z:
        for name, value in files.items(): z.writestr(name, value)
def recalc(files):
    w = xml(files, 'xl/workbook.xml')
    calc = w.find(q('calcPr'))
    if calc is None: calc = E.SubElement(w, q('calcPr'))
    calc.attrib.update(calcMode='auto', fullCalcOnLoad='1', forceFullCalc='1')
    put(files, 'xl/workbook.xml', w)
    files.pop('xl/calcChain.xml', None)
    for path, attr in [('xl/_rels/workbook.xml.rels','Target'),('[Content_Types].xml','PartName')]:
        root = xml(files, path)
        for child in list(root):
            if 'calcChain' in child.get(attr, ''): root.remove(child)
        put(files,path,root)
def app_properties(files, names):
    path='docProps/app.xml'
    if path not in files:return
    root=xml(files,path)
    vt='http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes'
    titles=root.find('.//{*}TitlesOfParts/{*}vector')
    if titles is not None:
        titles.clear();titles.attrib.update(size=str(len(names)),baseType='lpstr')
        for name in names:E.SubElement(titles,'{'+vt+'}lpstr').text=name
    heading=root.find('.//{*}HeadingPairs/{*}vector')
    if heading is not None:
        heading.clear();heading.attrib.update(size='2',baseType='variant')
        E.SubElement(E.SubElement(heading,'{'+vt+'}variant'),'{'+vt+'}lpstr').text='Worksheets'
        E.SubElement(E.SubElement(heading,'{'+vt+'}variant'),'{'+vt+'}i4').text=str(len(names))
    put(files,path,root)

quarter_path = ROOT/'Modelo  listado v(2.0).xlsx'
monthly_path = ROOT/'MODELO RESUMEN MENSUAL BENEFICIARIOS-con-reparto.xlsx'
backup = Path('/tmp/gestor-trimestral-antes-separar-reparto.xlsx')
quarter = read(quarter_path)
if 'xl/worksheets/sheet2.xml' not in quarter: raise SystemExit('El trimestral ya no contiene Reparto. No se ha modificado ningún archivo.')
if monthly_path.exists() or backup.exists(): raise SystemExit('Ya existe la salida o la copia: revisar antes de repetir.')
monthly = read(ROOT/'MODELO RESUMEN MENSUAL BENEFICIARIOS.xlsx')

# Incorporar los estilos de Reparto sin alterar los estilos del mensual original.
a=xml(monthly,'xl/styles.xml'); b=xml(quarter,'xl/styles.xml')
num_ids={}
nums=a.find(q('numFmts'))
if nums is None: nums=E.Element(q('numFmts'));a.insert(0,nums)
used={int(n.get('numFmtId')) for n in nums}
for n in b.findall('s:numFmts/s:numFmt',NS):
    old=int(n.get('numFmtId')); new=max(used|{163})+1; used.add(new);num_ids[old]=new
    n=deepcopy(n);n.set('numFmtId',str(new));nums.append(n)
nums.set('count',str(len(nums)))
offsets={}
for tag in ['fonts','fills','borders']:
    target=a.find(q(tag));source=b.find(q(tag));offsets[tag]=len(target)
    for child in source:target.append(deepcopy(child))
    target.set('count',str(len(target)))
def remap(xf, base=False):
    xf=deepcopy(xf)
    for attr, tag in [('fontId','fonts'),('fillId','fills'),('borderId','borders')]:
        if attr in xf.attrib:xf.set(attr,str(int(xf.get(attr))+offsets[tag]))
    if 'numFmtId' in xf.attrib:xf.set('numFmtId',str(num_ids.get(int(xf.get('numFmtId')),int(xf.get('numFmtId')))))
    if not base and 'xfId' in xf.attrib:xf.set('xfId',str(int(xf.get('xfId'))+offsets['cellStyleXfs']))
    return xf
for tag,base in [('cellStyleXfs',True),('cellXfs',False)]:
    target=a.find(q(tag));offsets[tag]=len(target)
    for xf in b.find(q(tag)):target.append(remap(xf,base))
    target.set('count',str(len(target)))
note_xf=deepcopy(a.find(q('cellXfs'))[7])
note_alignment=note_xf.find(q('alignment'))
note_alignment.set('wrapText','1');note_alignment.set('horizontal','left');note_alignment.set('vertical','center')
notes_style=len(a.find(q('cellXfs')))
a.find(q('cellXfs')).append(note_xf);a.find(q('cellXfs')).set('count',str(len(a.find(q('cellXfs')))))
put(monthly,'xl/styles.xml',a)

summary=xml(monthly,'xl/worksheets/sheet1.xml')
data=summary.find(q('sheetData'))
rows={int(r.get('r')):r for r in data}
def cell(ref, value=None, formula=None, style=2):
    rn=int(re.search(r'\d+$',ref)[0])
    if rn not in rows:rows[rn]=E.SubElement(data,q('row'),r=str(rn),ht='24',customHeight='1')
    row=rows[rn];c=next((c for c in row if c.get('r')==ref),None)
    if c is None:c=E.SubElement(row,q('c'),r=ref)
    c.clear();c.attrib.update(r=ref,s=str(style))
    if formula is not None:E.SubElement(c,q('f')).text=formula;E.SubElement(c,q('v'))
    elif isinstance(value,str):c.set('t','inlineStr');E.SubElement(E.SubElement(c,q('is')),q('t')).text=value
    elif value is not None:E.SubElement(c,q('v')).text=str(value)
    row[:]=sorted(row,key=lambda c:(len(re.sub(r'\d','',c.get('r'))),re.sub(r'\d','',c.get('r'))))
    return c
cell('C6','Lactantes (0–2)',style=2);cell('D6','Menores (3–17)',style=2);cell('E6','Adultos (18 o más)',style=2)
cell('B10','FAMILIAS ATENDIDAS EN EL MES',style=6)
cell('B12','Miembros por familia');cell('C12','N.º familias');cell('D12','Beneficiarios')
for i in range(13,23):
    cell(f'B{i}',i-12,style=2);cell(f'C{i}',style=4);cell(f'D{i}',formula=f'B{i}*C{i}',style=10)
cell('B23','TOTAL',style=9);cell('C23',formula='SUM(C13:C22)',style=10);cell('D23',formula='SUM(D13:D22)',style=10)
cell('G7',formula='C23',style=10)
cell('B25','Rellenar edades y familias con personas atendidas durante el mes. Una persona se cuenta una vez en cada resumen mensual.',style=notes_style)
cell('B26','Familias de más de 10 miembros: requieren revisión; no están incluidas en esta tabla de reparto.',style=notes_style)
cell('B27',formula='IF(COUNT(C7:E7)+COUNT(C13:C22)=0,"",IF(F7=D23,"Totales de edades y familias coinciden","REVISAR: edades y miembros de familias no coinciden; Reparto pendiente"))',style=notes_style)
merges=summary.find(q('mergeCells'))
for ref in ['B10:G10','B25:G25','B26:G26','B27:G27']:E.SubElement(merges,q('mergeCell'),ref=ref)
merges.set('count',str(len(merges)))
for rn in [25,26,27]:rows[rn].set('ht','40')
data[:]=sorted(data,key=lambda r:int(r.get('r')))
summary.find(q('dimension')).set('ref','B3:G27')
# Conserva las celdas de entrada desbloqueadas del modelo; nuevas C13:C22 usan ese estilo.
valid=E.Element(q('dataValidations'),count='1')
v=E.SubElement(valid,q('dataValidation'),type='whole',operator='greaterThanOrEqual',allowBlank='1',showErrorMessage='1',errorStyle='stop',errorTitle='Cantidad no válida',error='Indica un número entero mayor o igual que cero.',sqref='C7:E7 C13:C22')
E.SubElement(v,q('formula1')).text='0'
summary.insert(list(summary).index(merges)+1,valid)
put(monthly,'xl/worksheets/sheet1.xml',summary)

reparto=xml(quarter,'xl/worksheets/sheet2.xml')
strings=[''.join(si.itertext()) for si in xml(quarter,'xl/sharedStrings.xml')]
for c in reparto.findall('.//s:c',NS):
    if c.get('s'):c.set('s',str(int(c.get('s'))+offsets['cellXfs']))
    if c.get('t')=='s':
        text=strings[int(c.findtext(q('v')))];c.remove(c.find(q('v')));c.set('t','inlineStr');E.SubElement(E.SubElement(c,q('is')),q('t')).text=text
    if c.find(q('f')) is not None:
        for v in c.findall(q('v')):v.text=None
for col in reparto.findall('s:cols/s:col',NS):
    if col.get('style'):col.set('style',str(int(col.get('style'))+offsets['cellXfs']))
for row in reparto.findall('s:sheetData/s:row',NS):
    if row.get('s'):row.set('s',str(int(row.get('s'))+offsets['cellXfs']))
# La tabla estructurada de productos no es necesaria; se conserva el formato de celdas.
for tag in ['tableParts','conditionalFormatting']:
    for el in reparto.findall(q(tag)):reparto.remove(el)
rc={c.get('r'):c for c in reparto.findall('.//s:c',NS)}
name="'RESUMEN_MENSUAL_BENEFICIARIOS'"
for i,col in enumerate('DEFGHIJKLM'):
    f=rc[f'{col}13'].find(q('f'));f.attrib.clear();f.text=f'{name}!$C${13+i}'
for i in range(15,31):
    f=rc[f'N{i}'].find(q('f'));f.attrib.clear();f.text=f'IFERROR(IF({name}!$F$7=$N$12,$C{i}/$N$12,""),"")'
# El mensual no aplica reglas de vigencia: se rellena con las atenciones del mes.
notice=rc['B11'];notice.clear();notice.attrib.update(r='B11',s=str(offsets['cellXfs']+int(xml(quarter,'xl/worksheets/sheet2.xml').find('.//s:c[@r="B11"]',NS).get('s'))),t='inlineStr')
E.SubElement(E.SubElement(notice,q('is')),q('t')).text='Reparto basado en las familias atendidas del resumen mensual (1 a 10 miembros). Completa edades y tamaños de familia; sus totales de beneficiarios deben coincidir para calcular los envases.'
put(monthly,'xl/worksheets/sheet2.xml',reparto)
w=xml(monthly,'xl/workbook.xml');E.SubElement(w.find(q('sheets')),q('sheet'),name='Reparto',sheetId='2',attrib={'{'+R+'}id':'rIdReparto'})
put(monthly,'xl/workbook.xml',w)
rels=xml(monthly,'xl/_rels/workbook.xml.rels');E.SubElement(rels,'{'+P+'}Relationship',Id='rIdReparto',Type=R+'/worksheet',Target='worksheets/sheet2.xml');put(monthly,'xl/_rels/workbook.xml.rels',rels)
ct=xml(monthly,'[Content_Types].xml');E.SubElement(ct,'{'+CT+'}Override',PartName='/xl/worksheets/sheet2.xml',ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');put(monthly,'[Content_Types].xml',ct)
recalc(monthly);app_properties(monthly,['RESUMEN_MENSUAL_BENEFICIARIOS','Reparto'])

# Trimestral: retirar hoja, tabla asociada, nombres locales y relaciones.
w=xml(quarter,'xl/workbook.xml');sheets=w.find(q('sheets'))
for sh in list(sheets):
    if sh.get('name')=='Reparto':sheets.remove(sh)
for names in w.findall(q('definedNames')):
    for n in list(names):
        local=n.get('localSheetId')
        if local=='1' or 'Reparto!' in (n.text or ''):names.remove(n)
        elif local is not None and int(local)>1:n.set('localSheetId',str(int(local)-1))
for view in w.findall('s:bookViews/s:workbookView',NS):view.set('activeTab','0')
put(quarter,'xl/workbook.xml',w)
removed={'xl/worksheets/sheet2.xml','xl/worksheets/_rels/sheet2.xml.rels','xl/tables/table2.xml'}
for path in removed:quarter.pop(path,None)
rels=xml(quarter,'xl/_rels/workbook.xml.rels')
for r in list(rels):
    if r.get('Target')=='worksheets/sheet2.xml':rels.remove(r)
put(quarter,'xl/_rels/workbook.xml.rels',rels)
ct=xml(quarter,'[Content_Types].xml')
for c in list(ct):
    if c.get('PartName','').lstrip('/') in removed:ct.remove(c)
put(quarter,'[Content_Types].xml',ct)
recalc(quarter);app_properties(quarter,['Listado','Resumen'])
# Preparar ambas salidas en memoria antes de escribir; preservar el original mensual.
copyfile(quarter_path,backup)
save(monthly_path,monthly);save(quarter_path,quarter)
print(monthly_path)
print('Trimestral actualizado. Copia anterior:',backup)
