"""Comprueba integridad, referencias y prefijos de compatibilidad del XLSX."""
import sys
from io import BytesIO
from pathlib import PurePosixPath
import posixpath
import zipfile
import xml.etree.ElementTree as E

path = sys.argv[1]
MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    names = set(z.namelist())
    for name in names:
        if not name.endswith(('.xml', '.rels')):
            continue
        blob = z.read(name)
        pending, scopes = {}, []
        for event, value in E.iterparse(BytesIO(blob), events=['start-ns','start','end']):
            if event == 'start-ns':
                pending[value[0]] = value[1]
            elif event == 'start':
                scope = dict(scopes[-1]) if scopes else {}
                scope.update(pending); pending.clear(); scopes.append(scope)
                for attr in ['{' + MC + '}Ignorable', 'Requires']:
                    for prefix in value.get(attr, '').split():
                        assert prefix in scope, (name, attr, prefix, 'sin declaración')
            else:
                scopes.pop()
        root = E.fromstring(blob)
        if name.endswith('.rels'):
            base = '' if name == '_rels/.rels' else str(PurePosixPath(name).parent.parent)
            for rel in root:
                if rel.get('TargetMode') == 'External':
                    continue
                target = rel.get('Target', '')
                resolved = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(base,target))
                assert resolved in names, (name, resolved, 'destino inexistente')
        if name.startswith('xl/worksheets/') and name.endswith('.xml'):
            ns = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            masters, uses = set(), set()
            for f in root.findall('.//s:f', ns):
                if f.get('t') == 'shared':
                    uses.add(f.get('si'))
                    if f.text:
                        masters.add(f.get('si'))
            assert uses <= masters, (name, uses-masters, 'fórmulas compartidas huérfanas')
    print('OK: ZIP, XML, prefijos de compatibilidad, relaciones y fórmulas compartidas.')
