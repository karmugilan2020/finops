export function safeEval(expr, ctx){
try { return Function('metadata','state',`return (${expr})`)(ctx.metadata, ctx.state); } catch { return false; }
}
