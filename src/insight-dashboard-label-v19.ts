// Display labels only: API names, routes and saved keys keep their existing values.
function translate(root: Node) {
  const visit=(node: Node) => {
    if(node instanceof Element && node.matches('script,style,textarea,pre,code'))return;
    if(node.nodeType===Node.TEXT_NODE && node.textContent?.includes('Dashboard'))node.textContent=node.textContent.replace(/Dashboard/g,'ダッシュボード');
    if(node instanceof Element)for(const name of ['title','aria-label','placeholder']){const value=node.getAttribute(name);if(value?.includes('Dashboard'))node.setAttribute(name,value.replace(/Dashboard/g,'ダッシュボード'))}
    for(const child of Array.from(node.childNodes))visit(child);
  };
  visit(root);
}
function start(){translate(document.body);new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')translate(record.target);else if(record.type==='attributes')translate(record.target);else for(const node of record.addedNodes)translate(node)}}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
export {};
