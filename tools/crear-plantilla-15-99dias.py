"""Añade reglas de 99 días y Servicios Sociales directamente a la copia 1.5."""
from pathlib import Path
from io import BytesIO
import re
import zipfile
import xml.etree.ElementTree as E
from xml.sax.saxutils import quoteattr
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'Modelo  listado v(1.5)-prueba.xlsx'
TARGET=ROOT/'Modelo  listado v(1.5)-99dias-prueba.xlsx'
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
N={'s':NS}
with zipfile.ZipFile(SOURCE) as z:files={p:z.read(p) for p in z.namelist()}
def serialize(root,path):
    declarations=dict(v for _,v in E.iterparse(BytesIO(files[path]),events=['start-ns']))
    for prefix,uri in declarations.items():E.register_namespace(prefix,uri)
    text=E.tostring(root,encoding='unicode')
    opening=re.match(r'<[^>]+>',text).group()
    extra=''
    for prefix,uri in declarations.items():
        attr='xmlns'+(':'+prefix if prefix else '')
        if not re.search(r'\s'+re.escape(attr)+'=',opening):extra+=' '+attr+'='+quoteattr(uri)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+text[:len(opening)-1]+extra+text[len(opening)-1:]).encode()
def node(tag,attrs):return E.Element('{'+NS+'}'+tag,attrs)
END=2999
sheet=E.fromstring(files['xl/worksheets/sheet1.xml'])
data=sheet.find('s:sheetData',N)
rows={int(r.get('r')):r for r in data}
def put(root,ref,formula=None,text=None,style=None):
    sd=root.find('s:sheetData',N)
    rnum=re.search(r'\d+',ref).group()
    row=next((r for r in sd if r.get('r')==rnum),None)
    if row is None:row=node('row',{'r':rnum});sd.append(row)
    c=next((c for c in row if c.get('r')==ref),None)
    if c is None:c=node('c',{'r':ref});row.append(c)
    saved=style if style is not None else c.get('s','18')
    c.clear();c.attrib.update({'r':ref,'s':str(saved)})
    if formula is not None:
        f=node('f',{});f.text=formula;c.append(f);c.append(node('v',{}))
    else:
        c.set('t','inlineStr');v=node('is',{});t=node('t',{});t.text=text;v.append(t);c.append(v)
    return c
put(sheet,'M1',text='Servicios Sociales',style=rows[1][2].get('s'))
for i in range(2,END+1):
    # Identifica la primera fila de la familia sin cambiar la numeración manual.
    put(sheet,f'N{i}',formula=f'IF(COUNTA(B{i}:F{i})=0,"",IFERROR(LOOKUP(2,1/($A$2:A{i}<>""),ROW($A$2:A{i})),""))')
    for col,source in [('R','I'),('S','M'),('T','H'),('U','L')]:
        put(sheet,f'{col}{i}',formula=f'IFERROR(IF(OR(N{i}="",INDEX({source}:{source},N{i})=0),"",INDEX({source}:{source},N{i})),"")')
    valid_exp=f'AND(ISNUMBER(R{i}),R{i}=INT(R{i}),R{i}>=EDATE(TODAY(),-12),R{i}<=EDATE(TODAY(),48))'
    ss=f'OR(S{i}="Sí",AND(S{i}="No",ISNUMBER(T{i}),T{i}>=EDATE(TODAY(),-36),T{i}<=TODAY(),R{i}<=EDATE(T{i},3)))'
    cite=f'AND(ISNUMBER(U{i}),U{i}=INT(U{i}),U{i}>=TODAY(),U{i}>R{i},U{i}<=R{i}+99)'
    put(sheet,f'O{i}',formula=f'IFERROR(IF(AND(N{i}<>"",{valid_exp},{ss},OR(R{i}>=TODAY(),AND(R{i}>=TODAY()-99,{cite}))),1,0),0)')
    put(sheet,f'P{i}',formula=f'IF(A{i}="","",COUNTIFS($N$2:$N${END},ROW(),$O$2:$O${END},1))')
# M es la única columna visible nueva. Las auxiliares N:U quedan ocultas.
cols=sheet.find('s:cols',N)
for c in list(cols):
    if int(c.get('min'))>=13:cols.remove(c)
cols.append(node('col',{'min':'13','max':'13','width':'23','customWidth':'1'}))
cols.append(node('col',{'min':'14','max':'21','hidden':'1','width':'12','customWidth':'1'}))
validations=sheet.find('s:dataValidations',N)
validity='AND(ISNUMBER(I2),I2=INT(I2),I2>=EDATE(TODAY(),-12),I2<=EDATE(TODAY(),48),OR(S2="Sí",AND(S2="No",ISNUMBER(T2),T2>=EDATE(TODAY(),-36),T2<=TODAY(),I2<=EDATE(T2,3))))'
for v in validations:
    v.set('showInputMessage','0')
    if v.get('sqref','').startswith('I2:'):
        v.find('s:formula1',N).text=f'OR(I2="",IFERROR({validity},FALSE))'
        v.set('error','Revisa la fecha. Sin Servicios Sociales, la vigencia no puede superar Derivación + 3 meses. Indica Sí o No en la primera fila de la familia.')
def validation(area,formula,kind,error):
    v=node('dataValidation',{'sqref':area,'type':kind,'allowBlank':'1','showInputMessage':'0','showErrorMessage':'1','errorStyle':'stop','errorTitle':'Dato incorrecto','error':error})
    f=node('formula1',{});f.text=formula;v.append(f);validations.append(v)
validation(f'M2:M{END}','"Sí,No"','list','Selecciona Sí o No en la primera fila de la familia.')
appointment='AND(ISNUMBER(L2),L2=INT(L2),ISNUMBER(R2),L2>=TODAY(),L2>R2,L2<=R2+99)'
validation(f'L2:L{END}',f'OR(L2="",IFERROR({appointment},FALSE))','custom','La cita debe ser de hoy o futura y posterior al vencimiento, con un máximo de 99 días después de Vigencia.')
validations.set('count',str(len(validations)))
red=next(c.find('s:cfRule',N).get('dxfId') for c in sheet.findall('s:conditionalFormatting',N) if c.get('sqref')=='I2:I2999')
yellow=next(r.get('dxfId') for c in sheet.findall('s:conditionalFormatting',N) for r in c if 'G2>18' in (r.find('s:formula',N).text or ''))
for c in sheet.findall('s:conditionalFormatting',N):
    for r in c:r.set('priority',str(int(r.get('priority'))+2))
    if c.get('sqref')=='I2:I2999':c.find('.//s:formula',N).text=f'AND(I2<>"",NOT(IFERROR({validity},FALSE)))'
def highlight(area,formula,style,priority):
    c=node('conditionalFormatting',{'sqref':area});r=node('cfRule',{'type':'expression','dxfId':style,'priority':str(priority),'stopIfTrue':'1'})
    f=node('formula',{});f.text=formula;r.append(f);c.append(r);sheet.insert(list(sheet).index(validations),c)
highlight(f'L2:L{END}',f'IFERROR(OR(AND(L2<>"",NOT({appointment})),AND($A2<>"",ISNUMBER(R2),R2<TODAY(),L2="")),TRUE)',red,1)
highlight(f'M2:M{END}','AND($A2<>"",M2<>"Sí",M2<>"No")',yellow,2)
# No modifica las fórmulas ni los datos originales de A:K.
summary=E.fromstring(files['xl/worksheets/sheet3.xml'])
for i in range(4,14):put(summary,f'C{i}',formula=f'COUNTIFS(Listado!$A$2:$A${END},"<>",Listado!$P$2:$P${END},B{i})')
for i,low,high in [(4,0,2),(5,3,18),(6,19,100)]:
    put(summary,f'E{i}',formula=f'COUNTIFS(Listado!$O$2:$O${END},1,Listado!$G$2:$G${END},">={low}",Listado!$G$2:$G${END},"<={high}",Listado!$F$2:$F${END},">0")')
put(summary,'F4',formula=f'COUNTIFS(Listado!$A$2:$A${END},"<>",Listado!$P$2:$P${END},">0")')
put(summary,'G4',formula=f'SUM(Listado!$O$2:$O${END})')
def colnum(ref):
    out=0
    for c in re.match('[A-Z]+',ref).group():out=out*26+ord(c)-64
    return out
for path,root in [('xl/worksheets/sheet1.xml',sheet),('xl/worksheets/sheet3.xml',summary)]:
    sd=root.find('s:sheetData',N)
    for row in sd:row[:]=sorted(row,key=lambda c:colnum(c.get('r')))
    sd[:]=sorted(sd,key=lambda r:int(r.get('r')))
    files[path]=serialize(root,path)
# Conserva metadatos y declaraciones de la 1.5; sólo solicita recálculo.
w=E.fromstring(files['xl/workbook.xml']);calc=w.find('s:calcPr',N)
if calc is None:calc=node('calcPr',{});w.append(calc)
calc.attrib.update({'calcMode':'auto','fullCalcOnLoad':'1','forceFullCalc':'1'})
files['xl/workbook.xml']=serialize(w,'xl/workbook.xml')
files.pop('xl/calcChain.xml',None)
for path,attr in [('[Content_Types].xml','PartName'),('xl/_rels/workbook.xml.rels','Target')]:
    r=E.fromstring(files[path])
    for e in list(r):
        if 'calcChain' in e.get(attr,''):r.remove(e)
    files[path]=serialize(r,path)
with zipfile.ZipFile(TARGET,'w',zipfile.ZIP_DEFLATED) as z:
    for p,b in files.items():z.writestr(p,b)
print(TARGET)
