import {requireThat,problem} from './errors.js';
// Recursive parsing retains decoded object-key uniqueness before any domain lookup.
export function parseStrictJSON(source){
 let at=0;const whitespace=()=>{while(/[\x20\t\r\n]/.test(source[at]||'!'))at++;};
 function string(){const start=at++;while(at<source.length){const c=source[at++];if(c==='"'){try{return JSON.parse(source.slice(start,at));}catch{throw problem(400);}}if(c==='\\')at++;}throw problem(400);}
 function value(depth=0){
  requireThat(depth<=20);whitespace();const c=source[at];if(c==='"')return string();
  if(c==='{'){
   at++;const out=Object.create(null),seen=new Set();whitespace();if(source[at]==='}'){at++;return out;}
   while(at<source.length){whitespace();requireThat(source[at]==='"');const key=string();requireThat(!seen.has(key)&&!['__proto__','prototype','constructor'].includes(key));seen.add(key);whitespace();requireThat(source[at++]===':');out[key]=value(depth+1);whitespace();const token=source[at++];if(token==='}')return out;requireThat(token===',');}
   throw problem(400);
  }
  if(c==='['){at++;const out=[];whitespace();if(source[at]===']'){at++;return out;}while(at<source.length){out.push(value(depth+1));whitespace();const token=source[at++];if(token===']')return out;requireThat(token===',');}throw problem(400);}
  const m=/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(source.slice(at));requireThat(m);at+=m[0].length;return JSON.parse(m[0]);
 }
 requireThat(typeof source==='string');const result=value();whitespace();requireThat(at===source.length&&result&&typeof result==='object'&&!Array.isArray(result));return result;
}
export async function body(req){
 requireThat(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''));
 const bytes=await new Promise((resolve,reject)=>{let size=0,large=false;const chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>2097152){large=true;chunks.length=0;}else if(!large)chunks.push(chunk);});req.on('end',()=>large?reject(problem(413)):resolve(Buffer.concat(chunks)));req.on('error',()=>reject(problem(400)));req.on('aborted',()=>reject(problem(400)));});
 let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw problem(400);}return parseStrictJSON(source);
}
