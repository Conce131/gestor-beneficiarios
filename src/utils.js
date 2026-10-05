export function edad(d){if(!d)return"";let h=new Date(),n=new Date(d+"T00:00:00"),e=h.getFullYear()-n.getFullYear(),m=h.getMonth()-n.getMonth();if(m<0||(m===0&&h.getDate()<n.getDate()))e--;return e>=0?e:""}
export function caducada(d){return d && new Date(d+"T23:59:59")<new Date()}
export function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
export function fmt(d){return d?d.split("-").reverse().join("/"):"—"}
