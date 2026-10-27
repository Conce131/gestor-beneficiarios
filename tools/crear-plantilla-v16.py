"""Genera v1.6 desde la v1.5 revisada, conservando el archivo de entrada."""
from pathlib import Path
from io import BytesIO
import zipfile
import re
from xml.sax.saxutils import quoteattr
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Modelo  listado v(1.5)-prueba.xlsx'
TARGET = ROOT / 'Modelo  listado v(1.6)-corregida.xlsx'
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
N = {'s': NS}
END = 2999
with zipfile.ZipFile(SOURCE) as z:
    files = {p: z.read(p) for p in z.namelist()}
for prefix, uri in E.iterparse(BytesIO(files['xl/worksheets/sheet1.xml']), events=['start-ns']):
    E.register_namespace(uri[0], uri[1])
E.register_namespace('', NS)

def serialize(root, path):
    # Algunos prefijos sólo aparecen en atributos de compatibilidad (Requires,
    # Ignorable). ElementTree no conserva sus declaraciones automáticamente.
    declarations = dict(value for _, value in E.iterparse(BytesIO(files[path]), events=['start-ns']))
    for prefix, uri in declarations.items():
        E.register_namespace(prefix, uri)
    output = E.tostring(root, encoding='unicode', xml_declaration=False)
    opening = re.match(r'<[^>]+>', output).group()
    extra = ''
    for prefix, uri in declarations.items():
        attribute = 'xmlns' + (':' + prefix if prefix else '')
        if not re.search(r'\s' + re.escape(attribute) + r'=', opening):
            extra += ' ' + attribute + '=' + quoteattr(uri)
    output = output[:len(opening)-1] + extra + output[len(opening)-1:]
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + output).encode('utf-8')

def node(tag, attrs=None, text=None):
    e = E.Element('{%s}%s' % (NS, tag), attrs or {})
    e.text = text
    return e
sheet = E.fromstring(files['xl/worksheets/sheet1.xml'])
data = sheet.find('s:sheetData', N)
rows = {int(r.get('r')): r for r in data}
def cell(row, col, value=None, formula=None, style=None):
    r = rows[row]
    ref = f'{col}{row}'
    c = next((c for c in r if c.get('r') == ref), None)
    if c is None:
        c = node('c', {'r': ref}); r.append(c)
    saved = style if style is not None else c.get('s', '18')
    c.clear(); c.attrib.update({'r': ref, 's': str(saved)})
    if formula is not None:
        c.append(node('f', text=formula))
        c.append(node('v'))
    elif value is not None:
        c.set('t', 'inlineStr')
        inline = node('is'); inline.append(node('t', text=str(value))); c.append(inline)
    return c
styles = {c.get('r')[:-1]: c.get('s') for c in rows[2] if c.get('r').endswith('2')}
for i in range(2, END + 1):
    if i not in rows:
        rows[i] = node('row', {'r': str(i)}); data.append(rows[i])
    # Migra números existentes a la marca de inicio; la plantilla original se conserva.
    old_a = next((c for c in rows[i] if c.get('r') == f'A{i}'), None)
    if old_a is not None and old_a.find('s:v', N) is not None and old_a.find('s:v', N).text:
        cell(i, 'M', value='Sí')
    old_i = next((c for c in rows[i] if c.get('r') == f'I{i}'), None)
    if old_i is not None and old_i.find('s:v', N) is not None and old_i.find('s:v', N).text:
        raise ValueError('La copia contiene vigencias: migrarlas explícitamente antes de generar.')
    for col in ['C','D','E','F','H','L','M','N','O']:
        if not any(c.get('r') == f'{col}{i}' for c in rows[i]):
            cell(i, col, style=styles['H'] if col == 'O' else styles.get(col, styles['C']))
    next(c for c in rows[i] if c.get('r') == f'O{i}').set('s', styles['H'])
    cell(i,'U',formula=f'IF(COUNTA(C{i}:F{i})>0,1,0)')
    cell(i,'V',formula=f'IF(AND(U{i}=1,M{i}="Sí"),1,0)')
    cell(i,'P',formula=f'IF(U{i}=0,"",IF(SUM($V$2:V{i})=0,"",SUM($V$2:V{i})))')
    head = f'MATCH(P{i},$P$2:$P${END},0)'
    def family(col): return f'INDEX(${col}$2:${col}${END},{head})'
    cell(i,'A',formula=f'IF(V{i}=1,P{i},"")')
    cell(i,'B',formula=f'IF(U{i}=1,SUM($U$2:U{i}),"")')
    cell(i,'G',formula=f'IFERROR(IF(AND(ISNUMBER(F{i}),F{i}>=DATE(1900,1,1),F{i}<=TODAY()),DATEDIF(F{i},TODAY(),"Y"),""),"")')
    cell(i,'W',formula=f'IFERROR(IF(P{i}="","",IF({family("H")}=0,"",{family("H")})),"")',style=styles['H'])
    ss = family('N'); manual = family('O')
    cell(i,'I',formula=f'IFERROR(IF(OR(P{i}="",W{i}=""),"",IF({ss}="No",EDATE(W{i},3),IF(AND({ss}="Sí",ISNUMBER({manual}),{manual}>0),{manual},""))),"")',style=styles['I'])
    cell(i,'J',formula=f'IF(ISNUMBER(I{i}),I{i}-TODAY(),"")')
    cite = family('L')
    valid_deriv = f'AND(ISNUMBER(W{i}),W{i}=INT(W{i}),W{i}>=EDATE(TODAY(),-36),W{i}<=TODAY())'
    valid_expiry = f'AND(ISNUMBER(I{i}),I{i}=INT(I{i}),I{i}>=EDATE(TODAY(),-12),I{i}<=EDATE(TODAY(),48))'
    valid_cite = f'AND(ISNUMBER({cite}),{cite}=INT({cite}),{cite}>=TODAY(),{cite}<=I{i}+99)'
    cell(i,'R',formula=f'IFERROR(IF(AND(U{i}=1,P{i}<>"",OR({ss}="Sí",{ss}="No"),{valid_deriv},{valid_expiry},OR(I{i}>=TODAY(),AND(I{i}>=TODAY()-99,{valid_cite}))),1,0),0)')
    cell(i,'Q',formula=f'IF(P{i}="","",COUNTIF($P$2:$P${END},P{i}))')
    cell(i,'K',formula=f'IF(V{i}=1,Q{i},"")')
    cell(i,'S',formula=f'IF(P{i}="","",COUNTIFS($P$2:$P${END},P{i},$R$2:$R${END},1))')
    cell(i,'T',formula=f'IFERROR(IF(AND(V{i}=1,{ss}="No"),1,0),0)')
# Nouvelles colonnes visibles; aides cachées.
for col, label in [('M','Inicio de familia'),('N','Servicios Sociales'),('O','Vigencia indicada por Servicios Sociales')]:
    cell(1,col,value=label,style=rows[1][2].get('s'))
cols = sheet.find('s:cols',N)
for c in list(cols):
    if int(c.get('min')) >= 13: cols.remove(c)
for col,width in [(13,'20'),(14,'22'),(15,'28')]:
    cols.append(node('col',{'min':str(col),'max':str(col),'width':width,'customWidth':'1'}))
cols.append(node('col',{'min':'16','max':'23','hidden':'1','width':'12','customWidth':'1'}))
sheet.find('s:dimension',N).set('ref',f'A1:Y{max(rows)}')
# Corrige l'ordre des cellules et lignes après les ajouts.
def colnum(c):
    s=''.join(x for x in c.get('r') if x.isalpha()); v=0
    for x in s: v=v*26+ord(x)-64
    return v
for row in rows.values(): row[:]=sorted(row,key=colnum)
data[:]=sorted(data,key=lambda r:int(r.get('r')))
validations=sheet.find('s:dataValidations',N)
for v in validations:
    v.set('showInputMessage','0')
    v.attrib.pop('prompt',None); v.attrib.pop('promptTitle',None)
    if v.get('sqref','').startswith('I'):
        v.set('sqref',f'O2:O{END}')
        v.find('s:formula1',N).text=v.find('s:formula1',N).text.replace('I2','O2')
def validation(area, formula, kind='custom', error='Revisa el valor indicado.'):
    v=node('dataValidation',{'type':kind,'allowBlank':'1','showErrorMessage':'1','showInputMessage':'0','errorStyle':'stop','errorTitle':'Dato incorrecto','error':error,'sqref':area})
    v.append(node('formula1',text=formula));validations.append(v)
validation(f'M2:N{END}','"Sí,No"','list','Selecciona Sí o No.')
appointment='AND(ISNUMBER(L2),L2=INT(L2),ISNUMBER(I2),L2>=TODAY(),L2>I2,L2<=I2+99)'
validation(f'L2:L{END}',f'OR(L2="",IFERROR({appointment},FALSE))',error='La cita debe ser de hoy o futura, posterior al vencimiento y como máximo 99 días después de este.')
validations.set('count',str(len(validations)))
# Estilos de aviso existentes, conservados desde la copia revisada.
red=next(c.find('s:cfRule',N).get('dxfId') for c in sheet.findall('s:conditionalFormatting',N) if c.get('sqref')=='I2:I2999')
yellow=next(r.get('dxfId') for c in sheet.findall('s:conditionalFormatting',N) for r in c if 'G2>18' in (r.find('s:formula',N).text or ''))
for c in sheet.findall('s:conditionalFormatting',N):
    for r in c:r.set('priority',str(int(r.get('priority'))+6))
def highlight(area,formula,style,priority):
    c=node('conditionalFormatting',{'sqref':area})
    r=node('cfRule',{'type':'expression','dxfId':style,'priority':str(priority),'stopIfTrue':'1'})
    r.append(node('formula',text=formula));c.append(r)
    sheet.insert(list(sheet).index(validations),c)
highlight(f'L2:L{END}',f'AND($V2=1,IFERROR(OR(AND(L2<>"",NOT({appointment})),AND(ISNUMBER(I2),I2<TODAY(),L2="")),TRUE))',red,1)
highlight(f'N2:N{END}','AND($V2=1,N2<>"Sí",N2<>"No")',yellow,2)
highlight(f'M2:M{END}','AND($U2=1,OR($P2="",AND(M2<>"",M2<>"Sí",M2<>"No")))',yellow,3)
highlight(f'O2:O{END}','AND($V2=1,$N2="Sí",O2="")',yellow,4)
highlight(f'H2:H{END}','AND($V2=1,H2="")',yellow,5)
highlight(f'O2:O{END}','AND(O2<>"",NOT(IFERROR(AND(ISNUMBER(O2),O2=INT(O2),O2>=EDATE(TODAY(),-12),O2<=EDATE(TODAY(),48)),FALSE)))',red,6)
# Résumé et répartition partagent exactement le même périmètre.
summary=E.fromstring(files['xl/worksheets/sheet3.xml'])
def setf(root, ref, formula):
    c=next(c for c in root.findall('.//s:c',N) if c.get('r')==ref)
    for child in list(c):c.remove(child)
    c.attrib.pop('t',None);c.append(node('f',text=formula));c.append(node('v'))
for i in range(4,14):
    setf(summary,f'C{i}',f'COUNTIFS(Listado!$V$2:$V${END},1,Listado!$S$2:$S${END},B{i})')
for i,low,high in [(4,0,2),(5,3,18),(6,19,100)]:
    setf(summary,f'E{i}',f'COUNTIFS(Listado!$R$2:$R${END},1,Listado!$G$2:$G${END},">={low}",Listado!$G$2:$G${END},"<={high}",Listado!$F$2:$F${END},">0")')
setf(summary,'F4',f'COUNTIFS(Listado!$V$2:$V${END},1,Listado!$R$2:$R${END},1)')
setf(summary,'G4',f'SUM(Listado!$R$2:$R${END})')
sd=summary.find('s:sheetData',N)
for i,label,formula in [(16,'Familias sin Servicios Sociales (todas)',f'SUM(Listado!$T$2:$T${END})'),(17,'Familias sin Servicios Sociales incluidas en el recuento',f'COUNTIFS(Listado!$T$2:$T${END},1,Listado!$R$2:$R${END},1)')]:
    row=next((r for r in sd if r.get('r')==str(i)),None)
    if row is None:row=node('row',{'r':str(i)});sd.append(row)
    for ref,value,f in [(f'B{i}',label,None),(f'G{i}',None,formula)]:
        for old in list(row):
            if old.get('r')==ref:row.remove(old)
        c=node('c',{'r':ref})
        if f:c.append(node('f',text=f));c.append(node('v'))
        else:c.set('t','inlineStr');v=node('is');v.append(node('t',text=value));c.append(v)
        row.append(c)
    row[:]=sorted(row,key=colnum)
sd[:]=sorted(sd,key=lambda r:int(r.get('r')))
summary.find('s:dimension',N).set('ref','A1:H17')
reparto=E.fromstring(files['xl/worksheets/sheet2.xml'])
for index,col in enumerate('DEFGHIJKLM',1):
    setf(reparto,f'{col}13',f'COUNTIFS(Listado!$V$2:$V${END},1,Listado!$S$2:$S${END},{index})')
# Total réel, y compris les familles de plus de dix personnes.
setf(reparto,'N12',f'SUM(Listado!$R$2:$R${END})')
for path,root in [('xl/worksheets/sheet1.xml',sheet),('xl/worksheets/sheet2.xml',reparto),('xl/worksheets/sheet3.xml',summary)]:
    files[path]=serialize(root,path)
w=E.fromstring(files['xl/workbook.xml'])
calc=w.find('s:calcPr',N)
if calc is None:calc=node('calcPr');w.append(calc)
calc.attrib.update({'calcMode':'auto','fullCalcOnLoad':'1','forceFullCalc':'1'})
files['xl/workbook.xml']=serialize(w,'xl/workbook.xml')
# Supprime la chaîne de calcul devenue obsolète et ses références.
files.pop('xl/calcChain.xml',None)
for path,tag,attr in [('[Content_Types].xml','Override','PartName'),('xl/_rels/workbook.xml.rels','Relationship','Target')]:
    root=E.fromstring(files[path])
    for e in list(root):
        if 'calcChain' in e.get(attr,''): root.remove(e)
    files[path]=serialize(root,path)
# Les plages d'impression incluent les nouveaux champs.
with zipfile.ZipFile(TARGET,'w',zipfile.ZIP_DEFLATED) as z:
    for p,b in files.items():z.writestr(p,b)
print(TARGET)
