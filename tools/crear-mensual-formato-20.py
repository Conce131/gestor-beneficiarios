"""Nueva copia mensual con la distribución de Resumen 2.0 y reparto propio.

No modifica los modelos originales. Datos mensuales de entrada manual.
"""
from pathlib import Path
from copy import deepcopy
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as E
import re

ROOT = Path(__file__).resolve().parents[1]
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS = {'s': S}
E.register_namespace('', S)
E.register_namespace('r', R)
def q(tag): return '{'+S+'}'+tag
def load(path):
    with ZipFile(path) as z: return {n:z.read(n) for n in z.namelist()}
def xml(files, name): return E.fromstring(files[name])
def put(files, name, root):
    for el in root.iter():
        el.attrib.pop('{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable',None)
    for parent in root.iter():
        for el in list(parent):
            if el.tag=='{http://schemas.openxmlformats.org/markup-compatibility/2006}AlternateContent':parent.remove(el)
    files[name]=E.tostring(root,encoding='utf-8',xml_declaration=True)

out=ROOT/'MODELO RESUMEN MENSUAL BENEFICIARIOS-formato-2.0.xlsx'
if out.exists(): raise SystemExit('La copia ya existe; no se sobrescribe.')
files=load(ROOT/'MODELO RESUMEN MENSUAL BENEFICIARIOS-con-reparto.xlsx')
source=load(ROOT/'Modelo  listado v(2.0).xlsx')
layout=xml(source,'xl/worksheets/sheet3.xml')
source_cells={c.get('r'):c for c in layout.findall('.//s:c',NS)}

# Incorporar el formato de la tabla 2.0 sin alterar los estilos del reparto mensual.
styles=xml(files,'xl/styles.xml');src_styles=xml(source,'xl/styles.xml');offsets={}
num_ids={};nums=styles.find(q('numFmts'))
if nums is None:nums=E.Element(q('numFmts'));styles.insert(0,nums)
used={int(n.get('numFmtId')) for n in nums}
for num in src_styles.findall('s:numFmts/s:numFmt',NS):
    old=int(num.get('numFmtId'));new=max(used|{163})+1;used.add(new);num_ids[old]=new
    num=deepcopy(num);num.set('numFmtId',str(new));nums.append(num)
nums.set('count',str(len(nums)))
for tag in ['fonts','fills','borders']:
    dest=styles.find(q(tag));offsets[tag]=len(dest)
    for el in src_styles.find(q(tag)):dest.append(deepcopy(el))
    dest.set('count',str(len(dest)))
for tag in ['cellStyleXfs','cellXfs']:
    dest=styles.find(q(tag));offsets[tag]=len(dest)
    for original in src_styles.find(q(tag)):
        xf=deepcopy(original)
        for attr,collection in [('fontId','fonts'),('fillId','fills'),('borderId','borders')]:
            if attr in xf.attrib:xf.set(attr,str(int(xf.get(attr))+offsets[collection]))
        if 'numFmtId' in xf.attrib:xf.set('numFmtId',str(num_ids.get(int(xf.get('numFmtId')),int(xf.get('numFmtId')))))
        if tag=='cellXfs' and 'xfId' in xf.attrib:xf.set('xfId',str(int(xf.get('xfId'))+offsets['cellStyleXfs']))
        dest.append(xf)
    dest.set('count',str(len(dest)))
xfs=styles.find(q('cellXfs'))
def style(ref):return int(source_cells[ref].get('s','0'))+offsets['cellXfs']
def clone_style(base, unlocked=False, wrap=False, left=False):
    xf=deepcopy(xfs[base])
    if unlocked:
        protection=xf.find(q('protection'))
        if protection is None:protection=E.SubElement(xf,q('protection'))
        protection.set('locked','0');xf.set('applyProtection','1')
    if wrap or left:
        alignment=xf.find(q('alignment'))
        if alignment is None:alignment=E.Element(q('alignment'));xf.insert(0,alignment)
        alignment.set('vertical','center')
        if wrap:alignment.set('wrapText','1')
        if left:alignment.set('horizontal','left')
        xf.set('applyAlignment','1')
    index=len(xfs);xfs.append(xf);xfs.set('count',str(len(xfs)));return index
entry=clone_style(style('C4'),unlocked=True)
text_entry=clone_style(style('D4'),unlocked=True,wrap=True,left=True)
message=clone_style(style('D4'),wrap=True,left=True)
header=clone_style(style('B3'),wrap=True)
# Colores para campos pendientes y control de coherencia.
dxfs=styles.find(q('dxfs'))
if dxfs is None:
    dxfs=E.Element(q('dxfs'));styles.insert(list(styles).index(styles.find(q('tableStyles'))) if styles.find(q('tableStyles')) is not None else len(styles),dxfs)
def dxf(color):
    index=len(dxfs);node=E.SubElement(dxfs,q('dxf'));fill=E.SubElement(node,q('fill'));pattern=E.SubElement(fill,q('patternFill'),patternType='solid')
    E.SubElement(pattern,q('fgColor'),rgb=color);E.SubElement(pattern,q('bgColor'),indexed='64');dxfs.set('count',str(len(dxfs)));return index
pending=dxf('FFFFE699');good=dxf('FFE2F0D9');bad=dxf('FFF4CCCC')
# Muestra permanente del color de entrada, usada en la leyenda.
fills=styles.find(q('fills'));fill_id=len(fills);fill=E.SubElement(fills,q('fill'));pattern=E.SubElement(fill,q('patternFill'),patternType='solid');E.SubElement(pattern,q('fgColor'),rgb='FFFFE699');E.SubElement(pattern,q('bgColor'),indexed='64');fills.set('count',str(len(fills)))
legend=clone_style(style('D4'));xfs[legend].set('fillId',str(fill_id));xfs[legend].set('applyFill','1')
put(files,'xl/styles.xml',styles)

sheet=E.Element(q('worksheet'))
props=E.SubElement(sheet,q('sheetPr'));E.SubElement(props,q('pageSetUpPr'),fitToPage='1')
E.SubElement(sheet,q('dimension'),ref='B1:G20')
views=E.SubElement(sheet,q('sheetViews'));view=E.SubElement(views,q('sheetView'),workbookViewId='0',tabSelected='1',zoomScale='90')
E.SubElement(view,q('selection'),activeCell='C4',sqref='C4')
E.SubElement(sheet,q('sheetFormatPr'),defaultRowHeight='22')
cols=E.SubElement(sheet,q('cols'))
for col in layout.findall('s:cols/s:col',NS):
    if int(col.get('min'))>7:continue
    col=deepcopy(col);col.set('max',str(min(7,int(col.get('max')))));col.attrib.pop('style',None);cols.append(col)
data=E.SubElement(sheet,q('sheetData'));rows={}
def write(ref, value=None, formula=None, s=None):
    row=int(re.search(r'\d+$',ref)[0])
    if row not in rows:rows[row]=E.SubElement(data,q('row'),r=str(row),ht='26',customHeight='1')
    c=E.SubElement(rows[row],q('c'),r=ref,s=str(s if s is not None else style('D4')))
    if formula is not None:E.SubElement(c,q('f')).text=formula;E.SubElement(c,q('v'))
    elif isinstance(value,str):c.set('t','inlineStr');E.SubElement(E.SubElement(c,q('is')),q('t')).text=value
    elif value is not None:E.SubElement(c,q('v')).text=str(value)
    return c
write('B1','Entidad',s=header);write('C1',s=text_entry);write('F1','Mes/año',s=header);write('G1',s=text_entry)
write('B2','RESUMEN MENSUAL DE BENEFICIARIOS/AS',s=style('B2'))
for ref,text in [('B3','N.º familias por miembros'),('D3','Personas por edades'),('F3','Total familias'),('G3','Total beneficiarios')]:write(ref,text,s=header)
for i in range(4,14):write(f'B{i}',i-3,s=style('B4'));write(f'C{i}',s=entry)
for ref,label in [('D4','Lactantes: 0–2 años'),('D5','Menores: 3–17 años'),('D6','Adultos: 18 o más')]:write(ref,label,s=message)
for ref in ['E4','E5','E6']:write(ref,s=entry)
write('F4',formula='SUM(C4:C13)',s=style('F4'))
write('G4',formula='SUMPRODUCT(B4:B13,C4:C13)',s=style('G4'))
write('D8','Total por edades',s=header);write('E8',formula='SUM(E4:E6)',s=style('G4'))
complete='COUNT($C$4:$C$13,$E$4:$E$6)=13'
write('D10',formula=f'IF(NOT({complete}),"Pendiente: completa las casillas amarillas; escribe 0 cuando no haya personas o familias.",IF(G4=E8,"RECUENTO CORRECTO: coinciden edades y tamaños de familia.","REVISAR: diferencia de "&(G4-E8)&" personas entre familias y edades."))',s=message)
write('B16',s=legend);write('C16','Rellena las casillas de este color. Escribe 0 cuando no haya personas o familias de ese grupo.',s=message)
write('B19','Anota solo las personas y familias atendidas en el mes. Cada persona se cuenta una vez dentro de este resumen mensual.',s=message)
write('B20','La tabla de reparto admite familias de 1 a 10 miembros. Si hay familias mayores, se debe ampliar el modelo antes de utilizarlas.',s=message)
for row in rows.values():
    row[:]=sorted(row,key=lambda c:(len(re.sub(r'\d','',c.get('r'))),re.sub(r'\d','',c.get('r'))))
for num,height in [(1,32),(2,30),(3,40),(10,28),(11,28),(12,28),(16,40),(19,40),(20,40)]:
    if num in rows:rows[num].set('ht',str(height))
data[:]=sorted(data,key=lambda r:int(r.get('r')))
E.SubElement(sheet,q('sheetProtection'),sheet='1',selectLockedCells='0',selectUnlockedCells='0')
merges=E.SubElement(sheet,q('mergeCells'))
for ref in ['C1:E1','B2:G2','B3:C3','D3:E3','D10:G12','C16:G17','B19:G19','B20:G20']:E.SubElement(merges,q('mergeCell'),ref=ref)
merges.set('count',str(len(merges)))
priority=0
def conditional(area,formula,color):
    global priority
    priority+=1;cf=E.SubElement(sheet,q('conditionalFormatting'),sqref=area);rule=E.SubElement(cf,q('cfRule'),type='expression',dxfId=str(color),priority=str(priority));E.SubElement(rule,q('formula')).text=formula
for area,ref in [('C4:C13','C4'),('E4:E6','E4'),('C1:E1','$C$1'),('G1','G1')]:conditional(area,f'{ref}=""',pending)
conditional('D10:G12',f'AND({complete},$G$4=$E$8)',good)
conditional('D10:G12',f'AND({complete},$G$4<>$E$8)',bad)
valid=E.SubElement(sheet,q('dataValidations'),count='1');rule=E.SubElement(valid,q('dataValidation'),type='whole',operator='greaterThanOrEqual',allowBlank='1',showErrorMessage='1',errorStyle='stop',errorTitle='Cantidad no válida',error='Escribe un entero mayor o igual que cero.',sqref='C4:C13 E4:E6');E.SubElement(rule,q('formula1')).text='0'
E.SubElement(sheet,q('pageMargins'),left='0.3',right='0.3',top='0.5',bottom='0.5',header='0.2',footer='0.2')
E.SubElement(sheet,q('pageSetup'),paperSize='9',orientation='landscape',fitToWidth='1',fitToHeight='1')
put(files,'xl/worksheets/sheet1.xml',sheet)

rep=xml(files,'xl/worksheets/sheet2.xml');rc={c.get('r'):c for c in rep.findall('.//s:c',NS)}
name="'Resumen mensual'"
def set_formula(ref, text):
    c=rc[ref]
    for child in list(c):c.remove(child)
    c.attrib.pop('t',None);E.SubElement(c,q('f')).text=text;E.SubElement(c,q('v'))
for i,col in enumerate('DEFGHIJKLM'):set_formula(f'{col}13',f'{name}!$C${4+i}')
for i in range(15,31):
    set_formula(f'N{i}',f'IFERROR(IF(AND(COUNT({name}!$C$4:$C$13,{name}!$E$4:$E$6)=13,{name}!$E$8=$N$12),$C{i}/$N$12,""),"")')
    c=rc[f'C{i}']
    for child in list(c):c.remove(child)
    c.attrib.pop('t',None)
notice=rc['B11']
for child in list(notice):notice.remove(child)
notice.set('t','inlineStr');E.SubElement(E.SubElement(notice,q('is')),q('t')).text='Completa en Resumen mensual las familias por tamaño y las personas por edades, incluidos los ceros. El reparto se calcula cuando ambos totales coinciden. Introduce aquí las cantidades asignadas en envases.'
for view in rep.findall('s:sheetViews/s:sheetView',NS):view.set('tabSelected','0')
put(files,'xl/worksheets/sheet2.xml',rep)
w=xml(files,'xl/workbook.xml');sheets=w.find(q('sheets'));sheets[0].set('name','Resumen mensual')
for view in w.findall('s:bookViews/s:workbookView',NS):view.set('activeTab','0')
names=w.find(q('definedNames'))
if names is not None:w.remove(names)
names=E.Element(q('definedNames'));w.insert(list(w).index(w.find(q('calcPr'))),names)
E.SubElement(names,q('definedName'),name='_xlnm.Print_Area',localSheetId='0').text="'Resumen mensual'!$B$1:$G$20"
calc=w.find(q('calcPr'));calc.attrib.update(calcMode='auto',fullCalcOnLoad='1',forceFullCalc='1')
put(files,'xl/workbook.xml',w)
files.pop('xl/calcChain.xml',None)
for path,attr in [('xl/_rels/workbook.xml.rels','Target'),('[Content_Types].xml','PartName')]:
    root=xml(files,path)
    for child in list(root):
        if 'calcChain' in child.get(attr,''):root.remove(child)
    put(files,path,root)
app=xml(files,'docProps/app.xml');vt='http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';titles=app.find('.//{*}TitlesOfParts/{*}vector')
if titles is not None:
    titles.clear();titles.attrib.update(size='2',baseType='lpstr')
    for title in ['Resumen mensual','Reparto']:E.SubElement(titles,'{'+vt+'}lpstr').text=title
heading=app.find('.//{*}HeadingPairs/{*}vector')
if heading is not None:
    heading.clear();heading.attrib.update(size='2',baseType='variant');E.SubElement(E.SubElement(heading,'{'+vt+'}variant'),'{'+vt+'}lpstr').text='Worksheets';E.SubElement(E.SubElement(heading,'{'+vt+'}variant'),'{'+vt+'}i4').text='2'
put(files,'docProps/app.xml',app)
with ZipFile(out,'w',ZIP_DEFLATED) as z:
    for path,value in files.items():z.writestr(path,value)
print(out)
