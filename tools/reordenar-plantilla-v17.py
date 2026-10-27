"""Agrupa entradas a la izquierda y fórmulas a la derecha, sin protección."""
from pathlib import Path
from io import BytesIO
import re
import zipfile
import xml.etree.ElementTree as E
from xml.sax.saxutils import quoteattr
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'Modelo  listado v(1.6)-corregida.xlsx'
TARGET=ROOT/'Modelo  listado v(1.7)-prueba.xlsx'
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
N={'s':NS}
MAP=dict(zip('ABCDEFGHIJKLMNO','JKCDEFLGMNOIABH'))
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
def remap(text):
    return re.sub(r'(?<![A-Za-z0-9_])(\$?)([A-Z]{1,3})(\$?\d+)',lambda m:m[1]+MAP.get(m[2],m[2])+m[3],text)
def number(ref):
    value=0
    for c in re.match('[A-Z]+',ref).group():value=value*26+ord(c)-64
    return value
# Crea un estilo suave para distinguir las columnas calculadas sin bloquearlas.
styles=E.fromstring(files['xl/styles.xml'])
fills=styles.find('s:fills',N)
fill=node('fill',{});pattern=node('patternFill',{'patternType':'solid'})
pattern.append(node('fgColor',{'rgb':'FFE8EEF3'}));pattern.append(node('bgColor',{'indexed':'64'}));fill.append(pattern)
fill_id=len(fills);fills.append(fill);fills.set('count',str(len(fills)))
xfs=styles.find('s:cellXfs',N);variants={}
def formula_style(old):
    if old not in variants:
        xf=E.fromstring(E.tostring(xfs[int(old)]));xf.set('fillId',str(fill_id));xf.set('applyFill','1')
        variants[old]=str(len(xfs));xfs.append(xf)
    return variants[old]
sheet=E.fromstring(files['xl/worksheets/sheet1.xml'])
for row in sheet.findall('s:sheetData/s:row',N):
    for c in row:
        old=c.get('r');c.set('r',remap(old))
        for f in c.findall('s:f',N):
            if f.text:f.text=remap(f.text)
            if f.get('ref'):f.set('ref',remap(f.get('ref')))
        if int(row.get('r'))>1 and 10<=number(c.get('r'))<=15:
            c.set('s',formula_style(c.get('s','0')))
    row[:]=sorted(row,key=lambda c:number(c.get('r')))
for tag,attr in [('conditionalFormatting','sqref'),('dataValidation','sqref'),('mergeCell','ref'),('autoFilter','ref')]:
    for e in sheet.findall('.//s:'+tag,N):
        if e.get(attr):
            old=e.get(attr)
            if tag=='conditionalFormatting' and old=='A2:L2999':new='A2:O2999'
            else:new=remap(old)
            e.set(attr,new)
        for f in e:
            for descendant in f.iter():
                if descendant.tag.rsplit('}',1)[-1] in ['formula','formula1','formula2'] and descendant.text:
                    descendant.text=remap(descendant.text)
cols=sheet.find('s:cols',N)
cols[:]=[]
for i,width in enumerate([19,21,25,30,19,19,20,29,20,15,18,10,20,14,22],1):
    cols.append(node('col',{'min':str(i),'max':str(i),'width':str(width),'customWidth':'1'}))
cols.append(node('col',{'min':'16','max':'23','hidden':'1','width':'12','customWidth':'1'}))
for e in list(sheet):
    if e.tag=='{'+NS+'}sheetProtection':sheet.remove(e)
# Résumé et Reparto: convertir uniquement les références à Listado.
for path in ['xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml']:
    root=E.fromstring(files[path])
    for f in root.findall('.//s:f',N):
        if f.text:
            f.text=re.sub(r"(?:'Listado'|Listado)!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?",lambda m:remap(m[0]),f.text)
    files[path]=serialize(root,path)
files['xl/worksheets/sheet1.xml']=serialize(sheet,'xl/worksheets/sheet1.xml')
xfs.set('count',str(len(xfs)))
files['xl/styles.xml']=serialize(styles,'xl/styles.xml')
with zipfile.ZipFile(TARGET,'w',zipfile.ZIP_DEFLATED) as z:
    for p,b in files.items():z.writestr(p,b)
print(TARGET)
