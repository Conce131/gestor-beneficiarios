"""Aplica sólo las reglas de resumen y cita de 90 días a la copia 1.5."""
from pathlib import Path
from io import BytesIO
import re
import zipfile
import xml.etree.ElementTree as E
from xml.sax.saxutils import quoteattr
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'Modelo  listado v(1.5)-prueba.xlsx'
TARGET=ROOT/'Modelo  listado v(1.5)-auxiliares-resumen-90dias.xlsx'
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
summary=E.fromstring(files['xl/worksheets/sheet3.xml'])
for i in range(2,END+1):
    # INDEX sobre columnas completas conserva la correspondencia tras borrar filas.
    for col,source in [('S','A'),('T','G'),('U','F'),('W','L')]:
        put(summary,f'{col}{i}',formula=f'IF(INDEX(Listado!{source}:{source},ROW())="","",INDEX(Listado!{source}:{source},ROW()))')
    put(summary,f'V{i}',formula=f'IF(COUNTA(INDEX(Listado!B:B,ROW()):INDEX(Listado!F:F,ROW()))>0,1,0)')
    put(summary,f'N{i}',formula=f'IF(V{i}=0,"",IFERROR(LOOKUP(2,1/(INDEX(Listado!A:A,2):INDEX(Listado!A:A,ROW())<>""),ROW(INDEX(Listado!A:A,2):INDEX(Listado!A:A,ROW()))),""))')
    put(summary,f'O{i}',formula=f'IFERROR(IF(OR(N{i}="",INDEX(Listado!I:I,N{i})=0),"",INDEX(Listado!I:I,N{i})),"")')
    valid=f'AND(ISNUMBER(W{i}),W{i}=INT(W{i}),ISNUMBER(O{i}),O{i}>0,W{i}>=TODAY(),W{i}>O{i},W{i}<=O{i}+90)'
    put(summary,f'P{i}',formula=f'IF(W{i}="",0,IFERROR(IF({valid},0,1),1))')
    put(summary,f'Q{i}',formula=f'IFERROR(IF(AND(N{i}<>"",ISNUMBER(O{i}),O{i}>0,O{i}>=TODAY()-90,COUNTIFS($N$2:$N${END},N{i},$P$2:$P${END},1)=0),1,0),0)')
    put(summary,f'R{i}',formula=f'IF(S{i}="","",COUNTIFS($N$2:$N${END},ROW(),$Q$2:$Q${END},1))')
cols=summary.find('s:cols',N)
if cols is None:
    cols=node('cols',{});summary.insert(list(summary).index(summary.find('s:sheetData',N)),cols)
for c in list(cols):
    if int(c.get('min'))>=14:cols.remove(c)
    elif int(c.get('max'))>=14:c.set('max','13')
cols.append(node('col',{'min':'14','max':'23','hidden':'1','width':'12','customWidth':'1'}))
summary.find('s:dimension',N).set('ref',f'A1:W{END}')
put(summary,'B16',text='NO EDITAR NI BORRAR',style=next(c for c in summary.findall('.//s:c',N) if c.get('r')=='B2').get('s'))
merges=summary.find('s:mergeCells',N)
merges.append(node('mergeCell',{'ref':'B16:G16'}));merges.set('count',str(len(merges)))
validations=sheet.find('s:dataValidations',N)
for v in list(validations):
    if v.get('sqref','').startswith('L2:'):validations.remove(v)
v=node('dataValidation',{'sqref':f'L2:L{END}','type':'custom','allowBlank':'1','showInputMessage':'0','showErrorMessage':'1','errorStyle':'stop','errorTitle':'Próxima cita no válida','error':'La cita debe ser de hoy o futura y posterior a la vigencia. No es válida si es después de los 90 días desde el vencimiento de la vigencia.'})
f=node('formula1',{});f.text='OR(L2="",IFERROR(AND(ISNUMBER(L2),L2=INT(L2),ISNUMBER(INDEX(VigenciasFamilia,ROW())),INDEX(VigenciasFamilia,ROW())>0,L2>=TODAY(),L2>INDEX(VigenciasFamilia,ROW()),L2<=INDEX(VigenciasFamilia,ROW())+90),FALSE))';v.append(f);validations.append(v);validations.set('count',str(len(validations)))
red=next(c.find('s:cfRule',N).get('dxfId') for c in sheet.findall('s:conditionalFormatting',N) if c.get('sqref')=='I2:I2999')
for c in sheet.findall('s:conditionalFormatting',N):
    for r in c:r.set('priority',str(int(r.get('priority'))+1))
cf=node('conditionalFormatting',{'sqref':f'L2:L{END}'})
r=node('cfRule',{'type':'expression','dxfId':red,'priority':'1','stopIfTrue':'1'});f=node('formula',{});f.text='AND(L2<>"",INDEX(CitasInvalidas,ROW())=1)';r.append(f);cf.append(r);sheet.insert(list(sheet).index(validations),cf)
for i in range(4,14):put(summary,f'C{i}',formula=f'COUNTIFS($S$2:$S${END},"<>",$R$2:$R${END},B{i})')
for i,low,high in [(4,0,2),(5,3,18),(6,19,100)]:
    put(summary,f'E{i}',formula=f'COUNTIFS($Q$2:$Q${END},1,$T$2:$T${END},">={low}",$T$2:$T${END},"<={high}",$U$2:$U${END},">0")')
put(summary,'F4',formula=f'COUNTIFS($S$2:$S${END},"<>",$R$2:$R${END},">0")')
put(summary,'G4',formula=f'SUM($Q$2:$Q${END})')
def colnum(ref):
    out=0
    for c in re.match('[A-Z]+',ref).group():out=out*26+ord(c)-64
    return out
for path,root in [('xl/worksheets/sheet1.xml',sheet),('xl/worksheets/sheet3.xml',summary)]:
    sd=root.find('s:sheetData',N)
    for row in sd:row[:]=sorted(row,key=lambda c:colnum(c.get('r')))
    sd[:]=sorted(sd,key=lambda r:int(r.get('r')))
    files[path]=serialize(root,path)
w=E.fromstring(files['xl/workbook.xml'])
names=w.find('s:definedNames',N)
if names is None:
    names=node('definedNames',{});w.insert(list(w).index(w.find('s:calcPr',N)),names)
for name,ref in [('VigenciasFamilia','Resumen!$O:$O'),('CitasInvalidas','Resumen!$P:$P')]:
    d=node('definedName',{'name':name});d.text=ref;names.append(d)
calc=w.find('s:calcPr',N)
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
