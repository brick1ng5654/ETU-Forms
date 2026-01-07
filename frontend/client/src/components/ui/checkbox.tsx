import React from 'react';
import styled from 'styled-components';

export interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  className?: string;
  simplifiedAnimation?: boolean;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ 
    checked: controlledChecked,
    defaultChecked,
    onCheckedChange,
    className,
    disabled,
    required,
    name,
    value,
    id,
    simplifiedAnimation,
    ...props 
  }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked || false);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : uncontrolledChecked;
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    const handleChange = (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      
      const newChecked = !checked;
      
      if (!isControlled) {
        setUncontrolledChecked(newChecked);
      }
      
      if (onCheckedChange) {
        onCheckedChange(newChecked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleChange(e as any);
      }
    };

    return (
      <StyledWrapper
        className={className}
        data-animation={simplifiedAnimation ? 'simple' : 'default'}
      >
        <div className="cntr">
          {/* Скрытый input для форм */}
          <input
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            required={required}
            name={name}
            value={value}
            onChange={() => {}}
            className="hidden-xs-up"
            tabIndex={-1}
          />
          
          {/* Кнопка для взаимодействия*/}
          <button
            ref={ref}
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-required={required}
            disabled={disabled}
            data-state={checked ? 'checked' : 'unchecked'}
            data-disabled={disabled ? '' : undefined}
            onClick={handleChange}
            onKeyDown={handleKeyDown}
            className={`cbx ${disabled ? 'disabled' : ''}`}
            tabIndex={disabled ? -1 : 0}
            {...props}
          >
            {/* Индикатор галочки */}
            {checked && (
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 14 14" 
                className="check-icon"
                aria-hidden="true"
              >
                <path 
                  d="M11.5 4L5.5 10L2.5 7" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
          </button>
        </div>
      </StyledWrapper>
    );
  }
);

Checkbox.displayName = 'Checkbox';

const StyledWrapper = styled.div`
  display: inline-block;

  .cntr {
    position: relative;
    display: inline-block;
  }

  .hidden-xs-up {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  button.cbx {
    position: relative;
    width: 15px;
    height: 15px;
    border: 1px solid #c8ccd4;
    border-radius: 2px;
    vertical-align: middle;
    transition: all 0.2s ease;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    padding: 0;
    margin: 0;
    outline: none;
  }

  button.cbx.disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background: #f5f5f5;
  }

  button.cbx:hover:not(.disabled) {
    border-color: #05336e;
  }

  button.cbx[data-state='checked'] {
    border-color: transparent;
    background: #0f4d9eff;
    animation: jelly 0.6s ease;
  }

  &[data-animation='simple'] button.cbx[data-state='checked'] {
    animation: none;
  }

  button.cbx[data-state='checked'].disabled {
    background: #a0a7f0;
  }

  button.cbx .check-icon {
    animation: checkAnim 0.3s ease;
  }

  &[data-animation='simple'] button.cbx .check-icon {
    animation: none;
  }

  button.cbx:focus-visible {
    outline: 2px solid #6871f1;
    outline-offset: 2px;
  }

  @keyframes jelly {
    from {
      transform: scale(1, 1);
    }
    30% {
      transform: scale(1.25, 0.75);
    }
    40% {
      transform: scale(0.75, 1.25);
    }
    50% {
      transform: scale(1.15, 0.85);
    }
    65% {
      transform: scale(0.95, 1.05);
    }
    75% {
      transform: scale(1.05, 0.95);
    }
    to {
      transform: scale(1, 1);
    }
  }

  @keyframes checkAnim {
    from {
      opacity: 0;
      transform: scale(0.5) rotate(45deg);
    }
    to {
      opacity: 1;
      transform: scale(1) rotate(0);
    }
  }
`;

export { Checkbox };
