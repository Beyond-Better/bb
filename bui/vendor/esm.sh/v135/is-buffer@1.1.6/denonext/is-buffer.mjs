/* esm.sh - esbuild bundle(is-buffer@1.1.6) denonext production */
var a=Object.create;var c=Object.defineProperty;var B=Object.getOwnPropertyDescriptor;var m=Object.getOwnPropertyNames;var x=Object.getPrototypeOf,y=Object.prototype.hasOwnProperty;var w=(t,f)=>()=>(f||t((f={exports:{}}).exports,f),f.exports),E=(t,f)=>{for(var r in f)c(t,r,{get:f[r],enumerable:!0})},o=(t,f,r,s)=>{if(f&&typeof f=="object"||typeof f=="function")for(let n of m(f))!y.call(t,n)&&n!==r&&c(t,n,{get:()=>f[n],enumerable:!(s=B(f,n))||s.enumerable});return t},u=(t,f,r)=>(o(t,f,"default"),r&&o(r,f,"default")),l=(t,f,r)=>(r=t!=null?a(x(t)):{},o(f||!t||!t.__esModule?c(r,"default",{value:t,enumerable:!0}):r,t));var i=w((k,p)=>{p.exports=function(t){return t!=null&&(d(t)||F(t)||!!t._isBuffer)};function d(t){return!!t.constructor&&typeof t.constructor.isBuffer=="function"&&t.constructor.isBuffer(t)}function F(t){return typeof t.readFloatLE=="function"&&typeof t.slice=="function"&&d(t.slice(0,0))}});var e={};E(e,{default:()=>g});var L=l(i());u(e,l(i()));var{default:_,...S}=L,g=_!==void 0?_:S;export{g as default};
/*! Bundled license information:

is-buffer/index.js:
  (*!
   * Determine if an object is a Buffer
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
//# sourceMappingURL=is-buffer.mjs.map