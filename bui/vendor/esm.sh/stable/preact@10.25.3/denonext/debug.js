/* esm.sh - esbuild bundle(preact@10.25.3/debug) denonext production */
import{Fragment as L,options as a,Component as x}from"/stable/preact@10.25.3/denonext/preact.mjs";import"/stable/preact@10.25.3/denonext/devtools.js";var P={};function Z(){P={}}function v(t){return t.type===L?"Fragment":typeof t.type=="function"?t.type.displayName||t.type.name:typeof t.type=="string"?t.type:"#text"}var j=[],T=[];function R(){return j.length>0?j[j.length-1]:null}var D=!0;function U(t){return typeof t.type=="function"&&t.type!=L}function l(t){for(var p=[t],s=t;s.__o!=null;)p.push(s.__o),s=s.__o;return p.reduce(function(_,u){_+="  in "+v(u);var f=u.__source;return f?_+=" (at "+f.fileName+":"+f.lineNumber+")":D&&console.warn("Add @babel/plugin-transform-react-jsx-source to get a more detailed component stack. Note that you should not add it to production builds of your App for bundle size reasons."),D=!1,_+`
`},"")}var B=typeof WeakMap=="function";function W(t){var p=[];return t.__k&&t.__k.forEach(function(s){s&&typeof s.type=="function"?p.push.apply(p,W(s)):s&&typeof s.type=="string"&&p.push(s.type)}),p}function A(t){return t?typeof t.type=="function"?t.__==null?t.__e!=null&&t.__e.parentNode!=null?t.__e.parentNode.localName:"":A(t.__):t.type:""}var q=x.prototype.setState;function Y(t){return t==="table"||t==="tfoot"||t==="tbody"||t==="thead"||t==="td"||t==="tr"||t==="th"}x.prototype.setState=function(t,p){return this.__v==null&&this.state==null&&console.warn(`Calling "this.setState" inside the constructor of a component is a no-op and might be a bug in your application. Instead, set "this.state = {}" directly.

`+l(R())),q.call(this,t,p)};var G=/^(address|article|aside|blockquote|details|div|dl|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hgroup|hr|main|menu|nav|ol|p|pre|search|section|table|ul)$/,K=x.prototype.forceUpdate;function h(t){var p=t.props,s=v(t),_="";for(var u in p)if(p.hasOwnProperty(u)&&u!=="children"){var f=p[u];typeof f=="function"&&(f="function "+(f.displayName||f.name)+"() {}"),f=Object(f)!==f||f.toString?f+"":Object.prototype.toString.call(f),_+=" "+u+"="+JSON.stringify(f)}var O=p.children;return"<"+s+_+(O&&O.length?">..</"+s+">":" />")}x.prototype.forceUpdate=function(t){return this.__v==null?console.warn(`Calling "this.forceUpdate" inside the constructor of a component is a no-op and might be a bug in your application.

`+l(R())):this.__P==null&&console.warn(`Can't call "this.forceUpdate" on an unmounted component. This is a no-op, but it indicates a memory leak in your application. To fix, cancel all subscriptions and asynchronous tasks in the componentWillUnmount method.

`+l(this.__v)),K.call(this,t)},a.__m=function(t,p){var s=t.type,_=p.map(function(u){return u&&u.localName}).filter(Boolean);console.error('Expected a DOM node of type "'+s+'" but found "'+_.join(", ")+`" as available DOM-node(s), this is caused by the SSR'd HTML containing different DOM-nodes compared to the hydrated one.

`+l(t))},function(){(function(){var o=a.__b,n=a.diffed,e=a.__,c=a.vnode,i=a.__r;a.diffed=function(r){U(r)&&T.pop(),j.pop(),n&&n(r)},a.__b=function(r){U(r)&&j.push(r),o&&o(r)},a.__=function(r,d){T=[],e&&e(r,d)},a.vnode=function(r){r.__o=T.length>0?T[T.length-1]:null,c&&c(r)},a.__r=function(r){U(r)&&T.push(r),i&&i(r)}})();var t=!1,p=a.__b,s=a.diffed,_=a.vnode,u=a.__r,f=a.__e,O=a.__,z=a.__h,M=B?{useEffect:new WeakMap,useLayoutEffect:new WeakMap,lazyPropTypes:new WeakMap}:null,w=[];a.__e=function(o,n,e,c){if(n&&n.__c&&typeof o.then=="function"){var i=o;o=new Error("Missing Suspense. The throwing component was: "+v(n));for(var r=n;r;r=r.__)if(r.__c&&r.__c.__c){o=i;break}if(o instanceof Error)throw o}try{(c=c||{}).componentStack=l(n),f(o,n,e,c),typeof o.then!="function"&&setTimeout(function(){throw o})}catch(d){throw d}},a.__=function(o,n){if(!n)throw new Error(`Undefined parent passed to render(), this is the second argument.
Check if the element is available in the DOM/has the correct id.`);var e;switch(n.nodeType){case 1:case 11:case 9:e=!0;break;default:e=!1}if(!e){var c=v(o);throw new Error("Expected a valid HTML node as a second argument to render.	Received "+n+" instead: render(<"+c+" />, "+n+");")}O&&O(o,n)},a.__b=function(o){var n=o.type;if(t=!0,n===void 0)throw new Error(`Undefined component passed to createElement()

You likely forgot to export your component or might have mixed up default and named imports`+h(o)+`

`+l(o));if(n!=null&&typeof n=="object")throw n.__k!==void 0&&n.__e!==void 0?new Error("Invalid type passed to createElement(): "+n+`

Did you accidentally pass a JSX literal as JSX twice?

  let My`+v(o)+" = "+h(n)+`;
  let vnode = <My`+v(o)+` />;

This usually happens when you export a JSX literal and not the component.

`+l(o)):new Error("Invalid type passed to createElement(): "+(Array.isArray(n)?"array":n));if(o.ref!==void 0&&typeof o.ref!="function"&&typeof o.ref!="object"&&!("$$typeof"in o))throw new Error(`Component's "ref" property should be a function, or an object created by createRef(), but got [`+typeof o.ref+`] instead
`+h(o)+`

`+l(o));if(typeof o.type=="string"){for(var e in o.props)if(e[0]==="o"&&e[1]==="n"&&typeof o.props[e]!="function"&&o.props[e]!=null)throw new Error(`Component's "`+e+'" property should be a function, but got ['+typeof o.props[e]+`] instead
`+h(o)+`

`+l(o))}if(typeof o.type=="function"&&o.type.propTypes){if(o.type.displayName==="Lazy"&&M&&!M.lazyPropTypes.has(o.type)){var c="PropTypes are not supported on lazy(). Use propTypes on the wrapped component itself. ";try{var i=o.type();M.lazyPropTypes.set(o.type,!0),console.warn(c+"Component wrapped in lazy() is "+v(i))}catch{console.warn(c+"We will log the wrapped component's name once it is loaded.")}}var r=o.props;o.type.__f&&delete(r=function(d,m){for(var b in m)d[b]=m[b];return d}({},r)).ref,function(d,m,b,N,k){Object.keys(d).forEach(function(g){var y;try{y=d[g](m,g,N,"prop",null,"SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED")}catch(S){y=S}y&&!(y.message in P)&&(P[y.message]=!0,console.error("Failed prop type: "+y.message+(k&&`
`+k()||"")))})}(o.type.propTypes,r,0,v(o),function(){return l(o)})}p&&p(o)};var H,I=0;a.__r=function(o){u&&u(o),t=!0;var n=o.__c;if(n===H?I++:I=1,I>=25)throw new Error("Too many re-renders. This is limited to prevent an infinite loop which may lock up your browser. The component causing this is: "+v(o));H=n},a.__h=function(o,n,e){if(!o||!t)throw new Error("Hook can only be invoked from render methods.");z&&z(o,n,e)};var C=function(o,n){return{get:function(){var e="get"+o+n;w&&w.indexOf(e)<0&&(w.push(e),console.warn("getting vnode."+o+" is deprecated, "+n))},set:function(){var e="set"+o+n;w&&w.indexOf(e)<0&&(w.push(e),console.warn("setting vnode."+o+" is not allowed, "+n))}}},F={nodeName:C("nodeName","use vnode.type"),attributes:C("attributes","use vnode.props"),children:C("children","use vnode.props.children")},J=Object.create({},F);a.vnode=function(o){var n=o.props;if(o.type!==null&&n!=null&&("__source"in n||"__self"in n)){var e=o.props={};for(var c in n){var i=n[c];c==="__source"?o.__source=i:c==="__self"?o.__self=i:e[c]=i}}o.__proto__=J,_&&_(o)},a.diffed=function(o){var n,e=o.type,c=o.__;if(o.__k&&o.__k.forEach(function(E){if(typeof E=="object"&&E&&E.type===void 0){var $=Object.keys(E).join(",");throw new Error("Objects are not valid as a child. Encountered an object with the keys {"+$+`}.

`+l(o))}}),o.__c===H&&(I=0),typeof e=="string"&&(Y(e)||e==="p"||e==="a"||e==="button")){var i=A(c);if(i!==""&&Y(e))e==="table"&&i!=="td"&&Y(i)?(console.log(i,c.__e),console.error("Improper nesting of table. Your <table> should not have a table-node parent."+h(o)+`

`+l(o))):e!=="thead"&&e!=="tfoot"&&e!=="tbody"||i==="table"?e==="tr"&&i!=="thead"&&i!=="tfoot"&&i!=="tbody"?console.error("Improper nesting of table. Your <tr> should have a <thead/tbody/tfoot> parent."+h(o)+`

`+l(o)):e==="td"&&i!=="tr"?console.error("Improper nesting of table. Your <td> should have a <tr> parent."+h(o)+`

`+l(o)):e==="th"&&i!=="tr"&&console.error("Improper nesting of table. Your <th> should have a <tr>."+h(o)+`

`+l(o)):console.error("Improper nesting of table. Your <thead/tbody/tfoot> should have a <table> parent."+h(o)+`

`+l(o));else if(e==="p"){var r=W(o).filter(function(E){return G.test(E)});r.length&&console.error("Improper nesting of paragraph. Your <p> should not have "+r.join(", ")+" as child-elements."+h(o)+`

`+l(o))}else e!=="a"&&e!=="button"||W(o).indexOf(e)!==-1&&console.error("Improper nesting of interactive content. Your <"+e+"> should not have other "+(e==="a"?"anchor":"button")+" tags as child-elements."+h(o)+`

`+l(o))}if(t=!1,s&&s(o),o.__k!=null)for(var d=[],m=0;m<o.__k.length;m++){var b=o.__k[m];if(b&&b.key!=null){var N=b.key;if(d.indexOf(N)!==-1){console.error('Following component has two or more children with the same key attribute: "'+N+`". This may cause glitches and misbehavior in rendering process. Component: 

`+h(o)+`

`+l(o));break}d.push(N)}}if(o.__c!=null&&o.__c.__H!=null){var k=o.__c.__H.__;if(k)for(var g=0;g<k.length;g+=1){var y=k[g];if(y.__H){for(var S=0;S<y.__H.length;S++)if((n=y.__H[S])!=n){var X=v(o);console.warn("Invalid argument passed to hook. Hooks should not be called with NaN in the dependency array. Hook index "+g+" in component "+X+" was called with NaN.")}}}}}}();export{Z as resetPropWarnings};
//# sourceMappingURL=debug.js.map