// Small accessibility primitives shared by every form.

// role="alert" + aria-live so screen readers announce validation problems the
// moment they appear, not just on a visual color change (WCAG / ux "Error
// Messages must be announced").
export function FormError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" aria-live="assertive" className="text-label text-danger">
      {children}
    </p>
  );
}

// Visual required indicator. aria-hidden because the input's own `required`
// attribute already conveys this to assistive tech — the asterisk is sighted-user
// affordance only, so it isn't announced twice.
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-danger">
      {' '}
      *
    </span>
  );
}
