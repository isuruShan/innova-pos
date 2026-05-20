import { fieldAttrs } from './browser.js';

/**
 * Input/textarea that enforces shared maxLength (characters cannot be typed past limit).
 * Use fieldType from fieldAttrs; use type="textarea" or rows prop for multiline (description fields).
 */
export function LimitedInput({ fieldType, fieldOptions, className, type, rows, ...props }) {
  const attrs = fieldAttrs(fieldType, fieldOptions);
  const isTextarea = type === 'textarea' || rows != null;

  if (isTextarea) {
    return (
      <textarea
        {...props}
        rows={rows}
        maxLength={attrs.maxLength}
        placeholder={props.placeholder ?? attrs.placeholder}
        className={className}
      />
    );
  }

  return (
    <input
      {...props}
      type={type || 'text'}
      maxLength={attrs.maxLength}
      placeholder={props.placeholder ?? attrs.placeholder}
      autoComplete={props.autoComplete ?? attrs.autoComplete}
      inputMode={props.inputMode ?? attrs.inputMode}
      className={className}
    />
  );
}

export function limitedInputProps(fieldType, fieldOptions = {}) {
  const attrs = fieldAttrs(fieldType, fieldOptions);
  return {
    maxLength: attrs.maxLength,
    placeholder: attrs.placeholder,
    autoComplete: attrs.autoComplete,
    inputMode: attrs.inputMode,
  };
}
