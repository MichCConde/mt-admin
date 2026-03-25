export function Button({ variant = "primary", size = "", onClick, disabled, children }) {
  return (
    <button
      className={`btn btn-${variant} ${size ? `btn-${size}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}