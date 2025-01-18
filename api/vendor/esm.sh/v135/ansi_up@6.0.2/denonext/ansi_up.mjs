/* esm.sh - esbuild bundle(ansi_up@6.0.2) denonext production */
var _=function(n,e){return Object.defineProperty?Object.defineProperty(n,"raw",{value:e}):n.raw=e,n},l;(function(n){n[n.EOS=0]="EOS",n[n.Text=1]="Text",n[n.Incomplete=2]="Incomplete",n[n.ESC=3]="ESC",n[n.Unknown=4]="Unknown",n[n.SGR=5]="SGR",n[n.OSCURL=6]="OSCURL"})(l||(l={}));var g=class{constructor(){this.VERSION="6.0.2",this.setup_palettes(),this._use_classes=!1,this.bold=!1,this.faint=!1,this.italic=!1,this.underline=!1,this.fg=this.bg=null,this._buffer="",this._url_allowlist={http:1,https:1},this._escape_html=!0,this.boldStyle="font-weight:bold",this.faintStyle="opacity:0.7",this.italicStyle="font-style:italic",this.underlineStyle="text-decoration:underline"}set use_classes(e){this._use_classes=e}get use_classes(){return this._use_classes}set url_allowlist(e){this._url_allowlist=e}get url_allowlist(){return this._url_allowlist}set escape_html(e){this._escape_html=e}get escape_html(){return this._escape_html}set boldStyle(e){this._boldStyle=e}get boldStyle(){return this._boldStyle}set faintStyle(e){this._faintStyle=e}get faintStyle(){return this._faintStyle}set italicStyle(e){this._italicStyle=e}get italicStyle(){return this._italicStyle}set underlineStyle(e){this._underlineStyle=e}get underlineStyle(){return this._underlineStyle}setup_palettes(){this.ansi_colors=[[{rgb:[0,0,0],class_name:"ansi-black"},{rgb:[187,0,0],class_name:"ansi-red"},{rgb:[0,187,0],class_name:"ansi-green"},{rgb:[187,187,0],class_name:"ansi-yellow"},{rgb:[0,0,187],class_name:"ansi-blue"},{rgb:[187,0,187],class_name:"ansi-magenta"},{rgb:[0,187,187],class_name:"ansi-cyan"},{rgb:[255,255,255],class_name:"ansi-white"}],[{rgb:[85,85,85],class_name:"ansi-bright-black"},{rgb:[255,85,85],class_name:"ansi-bright-red"},{rgb:[0,255,0],class_name:"ansi-bright-green"},{rgb:[255,255,85],class_name:"ansi-bright-yellow"},{rgb:[85,85,255],class_name:"ansi-bright-blue"},{rgb:[255,85,255],class_name:"ansi-bright-magenta"},{rgb:[85,255,255],class_name:"ansi-bright-cyan"},{rgb:[255,255,255],class_name:"ansi-bright-white"}]],this.palette_256=[],this.ansi_colors.forEach(i=>{i.forEach(t=>{this.palette_256.push(t)})});let e=[0,95,135,175,215,255];for(let i=0;i<6;++i)for(let t=0;t<6;++t)for(let a=0;a<6;++a){let r={rgb:[e[i],e[t],e[a]],class_name:"truecolor"};this.palette_256.push(r)}let s=8;for(let i=0;i<24;++i,s+=10){let t={rgb:[s,s,s],class_name:"truecolor"};this.palette_256.push(t)}}escape_txt_for_html(e){return this._escape_html?e.replace(/[&<>"']/gm,s=>{if(s==="&")return"&amp;";if(s==="<")return"&lt;";if(s===">")return"&gt;";if(s==='"')return"&quot;";if(s==="'")return"&#x27;"}):e}append_buffer(e){var s=this._buffer+e;this._buffer=s}get_next_packet(){var e={kind:l.EOS,text:"",url:""},s=this._buffer.length;if(s==0)return e;var i=this._buffer.indexOf("\x1B");if(i==-1)return e.kind=l.Text,e.text=this._buffer,this._buffer="",e;if(i>0)return e.kind=l.Text,e.text=this._buffer.slice(0,i),this._buffer=this._buffer.slice(i),e;if(i==0){if(s<3)return e.kind=l.Incomplete,e;var t=this._buffer.charAt(1);if(t!="["&&t!="]"&&t!="(")return e.kind=l.ESC,e.text=this._buffer.slice(0,1),this._buffer=this._buffer.slice(1),e;if(t=="["){this._csi_regex||(this._csi_regex=o(b||(b=_([`
                        ^                           # beginning of line
                                                    #
                                                    # First attempt
                        (?:                         # legal sequence
                          \x1B[                      # CSI
                          ([<-?]?)              # private-mode char
                          ([d;]*)                    # any digits or semicolons
                          ([ -/]?               # an intermediate modifier
                          [@-~])                # the command
                        )
                        |                           # alternate (second attempt)
                        (?:                         # illegal sequence
                          \x1B[                      # CSI
                          [ -~]*                # anything legal
                          ([\0-:])              # anything illegal
                        )
                    `],[`
                        ^                           # beginning of line
                                                    #
                                                    # First attempt
                        (?:                         # legal sequence
                          \\x1b\\[                      # CSI
                          ([\\x3c-\\x3f]?)              # private-mode char
                          ([\\d;]*)                    # any digits or semicolons
                          ([\\x20-\\x2f]?               # an intermediate modifier
                          [\\x40-\\x7e])                # the command
                        )
                        |                           # alternate (second attempt)
                        (?:                         # illegal sequence
                          \\x1b\\[                      # CSI
                          [\\x20-\\x7e]*                # anything legal
                          ([\\x00-\\x1f:])              # anything illegal
                        )
                    `]))));let r=this._buffer.match(this._csi_regex);if(r===null)return e.kind=l.Incomplete,e;if(r[4])return e.kind=l.ESC,e.text=this._buffer.slice(0,1),this._buffer=this._buffer.slice(1),e;r[1]!=""||r[3]!="m"?e.kind=l.Unknown:e.kind=l.SGR,e.text=r[2];var a=r[0].length;return this._buffer=this._buffer.slice(a),e}else if(t=="]"){if(s<4)return e.kind=l.Incomplete,e;if(this._buffer.charAt(2)!="8"||this._buffer.charAt(3)!=";")return e.kind=l.ESC,e.text=this._buffer.slice(0,1),this._buffer=this._buffer.slice(1),e;this._osc_st||(this._osc_st=x(p||(p=_([`
                        (?:                         # legal sequence
                          (\x1B\\)                    # ESC                           |                           # alternate
                          (\x07)                      # BEL (what xterm did)
                        )
                        |                           # alternate (second attempt)
                        (                           # illegal sequence
                          [\0-]                 # anything illegal
                          |                           # alternate
                          [\b-]                 # anything illegal
                          |                           # alternate
                          [-]                 # anything illegal
                        )
                    `],[`
                        (?:                         # legal sequence
                          (\\x1b\\\\)                    # ESC \\
                          |                           # alternate
                          (\\x07)                      # BEL (what xterm did)
                        )
                        |                           # alternate (second attempt)
                        (                           # illegal sequence
                          [\\x00-\\x06]                 # anything illegal
                          |                           # alternate
                          [\\x08-\\x1a]                 # anything illegal
                          |                           # alternate
                          [\\x1c-\\x1f]                 # anything illegal
                        )
                    `])))),this._osc_st.lastIndex=0;{let h=this._osc_st.exec(this._buffer);if(h===null)return e.kind=l.Incomplete,e;if(h[3])return e.kind=l.ESC,e.text=this._buffer.slice(0,1),this._buffer=this._buffer.slice(1),e}{let h=this._osc_st.exec(this._buffer);if(h===null)return e.kind=l.Incomplete,e;if(h[3])return e.kind=l.ESC,e.text=this._buffer.slice(0,1),this._buffer=this._buffer.slice(1),e}this._osc_regex||(this._osc_regex=o(d||(d=_([`
                        ^                           # beginning of line
                                                    #
                        \x1B]8;                    # OSC Hyperlink
                        [ -:<-~]*       # params (excluding ;)
                        ;                           # end of params
                        ([!-~]{0,512})        # URL capture
                        (?:                         # ST
                          (?:\x1B\\)                  # ESC                           |                           # alternate
                          (?:\x07)                    # BEL (what xterm did)
                        )
                        ([ -~]+)              # TEXT capture
                        \x1B]8;;                   # OSC Hyperlink End
                        (?:                         # ST
                          (?:\x1B\\)                  # ESC                           |                           # alternate
                          (?:\x07)                    # BEL (what xterm did)
                        )
                    `],[`
                        ^                           # beginning of line
                                                    #
                        \\x1b\\]8;                    # OSC Hyperlink
                        [\\x20-\\x3a\\x3c-\\x7e]*       # params (excluding ;)
                        ;                           # end of params
                        ([\\x21-\\x7e]{0,512})        # URL capture
                        (?:                         # ST
                          (?:\\x1b\\\\)                  # ESC \\
                          |                           # alternate
                          (?:\\x07)                    # BEL (what xterm did)
                        )
                        ([\\x20-\\x7e]+)              # TEXT capture
                        \\x1b\\]8;;                   # OSC Hyperlink End
                        (?:                         # ST
                          (?:\\x1b\\\\)                  # ESC \\
                          |                           # alternate
                          (?:\\x07)                    # BEL (what xterm did)
                        )
                    `]))));let r=this._buffer.match(this._osc_regex);if(r===null)return e.kind=l.ESC,e.text=this._buffer.slice(0,1),this._buffer=this._buffer.slice(1),e;e.kind=l.OSCURL,e.url=r[1],e.text=r[2];var a=r[0].length;return this._buffer=this._buffer.slice(a),e}else if(t=="(")return e.kind=l.Unknown,this._buffer=this._buffer.slice(3),e}}ansi_to_html(e){this.append_buffer(e);for(var s=[];;){var i=this.get_next_packet();if(i.kind==l.EOS||i.kind==l.Incomplete)break;i.kind==l.ESC||i.kind==l.Unknown||(i.kind==l.Text?s.push(this.transform_to_html(this.with_state(i))):i.kind==l.SGR?this.process_ansi(i):i.kind==l.OSCURL&&s.push(this.process_hyperlink(i)))}return s.join("")}with_state(e){return{bold:this.bold,faint:this.faint,italic:this.italic,underline:this.underline,fg:this.fg,bg:this.bg,text:e.text}}process_ansi(e){let s=e.text.split(";");for(;s.length>0;){let i=s.shift(),t=parseInt(i,10);if(isNaN(t)||t===0)this.fg=null,this.bg=null,this.bold=!1,this.faint=!1,this.italic=!1,this.underline=!1;else if(t===1)this.bold=!0;else if(t===2)this.faint=!0;else if(t===3)this.italic=!0;else if(t===4)this.underline=!0;else if(t===21)this.bold=!1;else if(t===22)this.faint=!1,this.bold=!1;else if(t===23)this.italic=!1;else if(t===24)this.underline=!1;else if(t===39)this.fg=null;else if(t===49)this.bg=null;else if(t>=30&&t<38)this.fg=this.ansi_colors[0][t-30];else if(t>=40&&t<48)this.bg=this.ansi_colors[0][t-40];else if(t>=90&&t<98)this.fg=this.ansi_colors[1][t-90];else if(t>=100&&t<108)this.bg=this.ansi_colors[1][t-100];else if((t===38||t===48)&&s.length>0){let a=t===38,r=s.shift();if(r==="5"&&s.length>0){let f=parseInt(s.shift(),10);f>=0&&f<=255&&(a?this.fg=this.palette_256[f]:this.bg=this.palette_256[f])}if(r==="2"&&s.length>2){let f=parseInt(s.shift(),10),h=parseInt(s.shift(),10),u=parseInt(s.shift(),10);if(f>=0&&f<=255&&h>=0&&h<=255&&u>=0&&u<=255){let c={rgb:[f,h,u],class_name:"truecolor"};a?this.fg=c:this.bg=c}}}}}transform_to_html(e){let s=e.text;if(s.length===0||(s=this.escape_txt_for_html(s),!e.bold&&!e.italic&&!e.underline&&e.fg===null&&e.bg===null))return s;let i=[],t=[],a=e.fg,r=e.bg;e.bold&&i.push(this._boldStyle),e.faint&&i.push(this._faintStyle),e.italic&&i.push(this._italicStyle),e.underline&&i.push(this._underlineStyle),this._use_classes?(a&&(a.class_name!=="truecolor"?t.push(`${a.class_name}-fg`):i.push(`color:rgb(${a.rgb.join(",")})`)),r&&(r.class_name!=="truecolor"?t.push(`${r.class_name}-bg`):i.push(`background-color:rgb(${r.rgb.join(",")})`))):(a&&i.push(`color:rgb(${a.rgb.join(",")})`),r&&i.push(`background-color:rgb(${r.rgb})`));let f="",h="";return t.length&&(f=` class="${t.join(" ")}"`),i.length&&(h=` style="${i.join(";")}"`),`<span${h}${f}>${s}</span>`}process_hyperlink(e){let s=e.url.split(":");return s.length<1||!this._url_allowlist[s[0]]?"":`<a href="${this.escape_txt_for_html(e.url)}">${this.escape_txt_for_html(e.text)}</a>`}};function o(n,...e){let s=n.raw[0],i=/^\s+|\s+\n|\s*#[\s\S]*?\n|\n/gm,t=s.replace(i,"");return new RegExp(t)}function x(n,...e){let s=n.raw[0],i=/^\s+|\s+\n|\s*#[\s\S]*?\n|\n/gm,t=s.replace(i,"");return new RegExp(t,"g")}var b,p,d;export{g as AnsiUp};
//# sourceMappingURL=ansi_up.mjs.map