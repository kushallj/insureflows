export type TemplateVars = Record<string, string>;

export const SAMPLE_VARS: TemplateVars = {
  name: "Priya Sharma",
  city: "Mumbai",
  renewal_date: "15 Aug 2026",
  policy: "HDFC Life Click 2 Protect",
  advisor_name: "You",
  premium: "₹12,400",
};

export function renderTemplate(body: string, vars: TemplateVars): string {
  if (!body) return "";
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    return vars[key] ?? `{{${key}}}`;
  });
}
