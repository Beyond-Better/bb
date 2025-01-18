/* esm.sh - esbuild bundle(common-tags@1.8.2) denonext production */
var P=function(){function i(r,t){for(var e=0;e<t.length;e++){var o=t[e];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(r,o.key,o)}}return function(r,t,e){return t&&i(r.prototype,t),e&&i(r,e),r}}(),q=H(["",""],["",""]);function H(i,r){return Object.freeze(Object.defineProperties(i,{raw:{value:Object.freeze(r)}}))}function z(i,r){if(!(i instanceof r))throw new TypeError("Cannot call a class as a function")}var M=function(){function i(){for(var r=this,t=arguments.length,e=Array(t),o=0;o<t;o++)e[o]=arguments[o];return z(this,i),this.tag=function(m){for(var f=arguments.length,p=Array(f>1?f-1:0),T=1;T<f;T++)p[T-1]=arguments[T];return typeof m=="function"?r.interimTag.bind(r,m):typeof m=="string"?r.transformEndResult(m):(m=m.map(r.transformString.bind(r)),r.transformEndResult(m.reduce(r.processSubstitutions.bind(r,p))))},e.length>0&&Array.isArray(e[0])&&(e=e[0]),this.transformers=e.map(function(m){return typeof m=="function"?m():m}),this.tag}return P(i,[{key:"interimTag",value:function(t,e){for(var o=arguments.length,m=Array(o>2?o-2:0),f=2;f<o;f++)m[f-2]=arguments[f];return this.tag(q,t.apply(void 0,[e].concat(m)))}},{key:"processSubstitutions",value:function(t,e,o){var m=this.transformSubstitution(t.shift(),e);return"".concat(e,m,o)}},{key:"transformString",value:function(t){var e=function(m,f){return f.onString?f.onString(m):m};return this.transformers.reduce(e,t)}},{key:"transformSubstitution",value:function(t,e){var o=function(f,p){return p.onSubstitution?p.onSubstitution(f,e):f};return this.transformers.reduce(o,t)}},{key:"transformEndResult",value:function(t){var e=function(m,f){return f.onEndResult?f.onEndResult(m):m};return this.transformers.reduce(e,t)}}]),i}(),n=M;var $=function(){var r=arguments.length>0&&arguments[0]!==void 0?arguments[0]:"";return{onEndResult:function(e){if(r==="")return e.trim();if(r=r.toLowerCase(),r==="start"||r==="left")return e.replace(/^\s*/,"");if(r==="end"||r==="right")return e.replace(/\s*$/,"");throw new Error("Side not supported: "+r)}}},a=$;function k(i){if(Array.isArray(i)){for(var r=0,t=Array(i.length);r<i.length;r++)t[r]=i[r];return t}else return Array.from(i)}var F=function(){var r=arguments.length>0&&arguments[0]!==void 0?arguments[0]:"initial";return{onEndResult:function(e){if(r==="initial"){var o=e.match(/^[^\S\n]*(?=\S)/gm),m=o&&Math.min.apply(Math,k(o.map(function(p){return p.length})));if(m){var f=new RegExp("^.{"+m+"}","gm");return e.replace(f,"")}return e}if(r==="all")return e.replace(/^[^\S\n]+/gm,"");throw new Error("Unknown type: "+r)}}},l=F;var U=function(r,t){return{onEndResult:function(o){if(r==null||t==null)throw new Error("replaceResultTransformer requires at least 2 arguments.");return o.replace(r,t)}}},u=U;var Y=function(r,t){return{onSubstitution:function(o,m){if(r==null||t==null)throw new Error("replaceSubstitutionTransformer requires at least 2 arguments.");return o==null?o:o.toString().replace(r,t)}}},d=Y;var D=function(r,t){return{onString:function(o){if(r==null||t==null)throw new Error("replaceStringTransformer requires at least 2 arguments.");return o.replace(r,t)}}},L=D;var G={separator:"",conjunction:"",serial:!1},J=function(){var r=arguments.length>0&&arguments[0]!==void 0?arguments[0]:G;return{onSubstitution:function(e,o){if(Array.isArray(e)){var m=e.length,f=r.separator,p=r.conjunction,T=r.serial,v=o.match(/(\n?[^\S\n]+)$/);if(v?e=e.join(f+v[1]):e=e.join(f+" "),p&&m>1){var S=e.lastIndexOf(f);e=e.slice(0,S)+(T?f:"")+" "+p+e.slice(S+1)}}return e}}},s=J;var K=function(r){return{onSubstitution:function(e,o){if(r!=null&&typeof r=="string")typeof e=="string"&&e.includes(r)&&(e=e.split(r));else throw new Error("You need to specify a string character to split by.");return e}}},c=K;var _=function(r){return r!=null&&!Number.isNaN(r)&&typeof r!="boolean"},Q=function(){return{onSubstitution:function(t){return Array.isArray(t)?t.filter(_):_(t)?t:""}}},x=Q;var X=new n(s({separator:","}),l,a),y=X;var Z=new n(s({separator:",",conjunction:"and"}),l,a),R=Z;var B=new n(s({separator:",",conjunction:"or"}),l,a),h=B;var W=new n(c(`
`),x,s,l,a),g=W;var rr=new n(c(`
`),s,l,a,d(/&/g,"&amp;"),d(/</g,"&lt;"),d(/>/g,"&gt;"),d(/"/g,"&quot;"),d(/'/g,"&#x27;"),d(/`/g,"&#x60;")),A=rr;var er=new n(u(/(?:\n(?:\s*))+/g," "),a),w=er;var tr=new n(u(/(?:\n\s*)/g,""),a),b=tr;var or=new n(s({separator:","}),u(/(?:\s+)/g," "),a),I=or;var nr=new n(s({separator:",",conjunction:"or"}),u(/(?:\s+)/g," "),a),E=nr;var ar=new n(s({separator:",",conjunction:"and"}),u(/(?:\s+)/g," "),a),C=ar;var mr=new n(s,l,a),j=mr;var ir=new n(s,u(/(?:\s+)/g," "),a),O=ir;var fr=new n(l,a),V=fr;var sr=new n(l("all"),a),N=sr;export{n as TemplateTag,g as codeBlock,y as commaLists,R as commaListsAnd,h as commaListsOr,g as html,s as inlineArrayTransformer,j as inlineLists,w as oneLine,I as oneLineCommaLists,C as oneLineCommaListsAnd,E as oneLineCommaListsOr,O as oneLineInlineLists,b as oneLineTrim,x as removeNonPrintingValuesTransformer,u as replaceResultTransformer,L as replaceStringTransformer,d as replaceSubstitutionTransformer,A as safeHtml,g as source,c as splitStringTransformer,V as stripIndent,l as stripIndentTransformer,N as stripIndents,a as trimResultTransformer};
//# sourceMappingURL=common-tags.mjs.map