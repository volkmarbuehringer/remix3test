/**
 * Returns an inline <script> string that installs an input event listener
 * for live password-complexity feedback. Use inside any password form.
 *
 * @param fieldName - The `name` attribute of the password input to watch
 *   (e.g. "password" on the register form, "newPassword" on the settings form).
 */
export function passwordComplexityScript(fieldName: string): string {
  if (!/^[a-zA-Z]\w*$/.test(fieldName)) {
    throw new Error(`Invalid field name for password complexity script: ${fieldName}`)
  }
  return `document.addEventListener('input',e=>{let i=e.target;if(i.name!=='${fieldName}')return;let f=i.closest('form');if(!f)return;let g=f.querySelector('[data-pw-complexity]');if(!g)return;let v=i.value;g.innerHTML=[['Mindestens 10 Zeichen',v.length>=10],['Mindestens eine Zahl (0-9)',/[0-9]/.test(v)],['Mindestens ein Sonderzeichen',/[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?\`~]/.test(v)]].map(r=>'<span style="display:flex;align-items:center;gap:4px;font-size:12px;color:'+(r[1]?'#16a34a':'#6b7280')+'">'+(r[1]?'\\u2713':'\\u25CB')+' '+r[0]+'</span>').join('')})`
}
