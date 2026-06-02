/**
 * Basic form validation utility functions
 */

export type ValidationResult = {
  isValid: boolean;
  errorMessage?: string;
};

// Define possible valid values for validation
export type ValidatableValue = string | number | boolean | string[] | number[] | null | undefined;

export interface Validator {
  (value: ValidatableValue): ValidationResult;
}

/**
 * Create a required field validator
 * @param message Custom error message
 * @returns Validator function
 */
export function required(message = 'This field is required'): Validator {
  return (value: ValidatableValue): ValidationResult => {
    // Check for undefined, null, empty string, or empty array
    const isEmpty = 
      value === undefined || 
      value === null || 
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    
    return {
      isValid: !isEmpty,
      errorMessage: isEmpty ? message : undefined
    };
  };
}

/**
 * Create a minimum length validator
 * @param min Minimum length
 * @param message Custom error message
 * @returns Validator function
 */
export function minLength(min: number, message?: string): Validator {
  return (value: ValidatableValue): ValidationResult => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true }; // Let required validator handle empty values
    }
    
    const stringValue = String(value);
    const isValid = stringValue.length >= min;
    return {
      isValid,
      errorMessage: isValid ? undefined : message || `Must be at least ${min} characters`
    };
  };
}

/**
 * Create a maximum length validator
 * @param max Maximum length
 * @param message Custom error message
 * @returns Validator function
 */
export function maxLength(max: number, message?: string): Validator {
  return (value: ValidatableValue): ValidationResult => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true }; // Let required validator handle empty values
    }
    
    const stringValue = String(value);
    const isValid = stringValue.length <= max;
    return {
      isValid,
      errorMessage: isValid ? undefined : message || `Must be no more than ${max} characters`
    };
  };
}

/**
 * Create an email validator
 * @param message Custom error message
 * @returns Validator function
 */
export function email(message = 'Please enter a valid email address'): Validator {
  return (value: ValidatableValue): ValidationResult => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true }; // Let required validator handle empty values
    }
    
    // RFC 5322 compliant regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    const stringValue = String(value);
    const isValid = emailRegex.test(stringValue);
    
    return {
      isValid,
      errorMessage: isValid ? undefined : message
    };
  };
}

/**
 * Create a pattern validator with a custom regex
 * @param pattern Regular expression to test
 * @param message Custom error message
 * @returns Validator function
 */
export function pattern(pattern: RegExp, message: string): Validator {
  return (value: ValidatableValue): ValidationResult => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true }; // Let required validator handle empty values
    }
    
    const stringValue = String(value);
    const isValid = pattern.test(stringValue);
    return {
      isValid,
      errorMessage: isValid ? undefined : message
    };
  };
}

/**
 * Run multiple validators on a value
 * @param value Value to validate
 * @param validators Array of validators to run
 * @returns First failing validation result, or valid result if all pass
 */
export function validate(value: ValidatableValue, validators: Validator[]): ValidationResult {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.isValid) {
      return result;
    }
  }
  
  return { isValid: true };
} 