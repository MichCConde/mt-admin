export function Input({ type = "text", className = "", ...props }) {
  return <input type={type} className={`input ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return <select className={`select ${className}`} {...props}>{children}</select>;
}

export function DateInput(props) {
  return <input type="date" className="input input-sm" {...props} />;
}

export function TimeInput(props) {
  return <input type="time" className="input input-sm" {...props} />;
}