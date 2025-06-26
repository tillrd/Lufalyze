import React, { useEffect, useRef, useState, forwardRef, ReactNode } from 'react';
import { PopoverManager } from '../../shared/utils/modernFeatures';

// Modern HTML: Popover component using the Popover API
interface PopoverProps {
  children: ReactNode;
  trigger: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  onToggle?: (open: boolean) => void;
}

const ModernPopover: React.FC<PopoverProps> = ({ 
  children, 
  trigger, 
  placement = 'bottom', 
  className = '',
  onToggle 
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(PopoverManager.isSupported());
  }, []);

  const handleToggle = () => {
    if (isSupported && popoverRef.current) {
      const success = PopoverManager.toggle(popoverRef.current);
      if (success) {
        const newState = !isOpen;
        setIsOpen(newState);
        onToggle?.(newState);
      }
    } else {
      // Fallback for browsers without Popover API
      const newState = !isOpen;
      setIsOpen(newState);
      onToggle?.(newState);
    }
  };

  useEffect(() => {
    if (!isSupported) return;

    const popover = popoverRef.current;
    if (!popover) return;

    const handleToggleEvent = (event: Event) => {
      const newState = (event as any).newState === 'open';
      setIsOpen(newState);
      onToggle?.(newState);
    };

    popover.addEventListener('toggle', handleToggleEvent);
    return () => popover.removeEventListener('toggle', handleToggleEvent);
  }, [isSupported, onToggle]);

  if (isSupported) {
    return (
      <>
        <div onClick={handleToggle} style={{ cursor: 'pointer' }}>
          {trigger}
        </div>
        <div
          ref={popoverRef}
          {...({ popover: 'auto' } as any)}
          className={`${className} modern-popover`}
          style={{
            margin: 'auto',
            padding: '1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {children}
        </div>
      </>
    );
  }

  // Fallback implementation
  return (
    <div className="relative">
      <div onClick={handleToggle} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className={`absolute z-50 ${className}`}
          style={{
            [placement]: '100%',
            padding: '1rem',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

// Modern HTML: Mutually exclusive details elements
interface MutuallyExclusiveDetailsProps {
  items: Array<{
    summary: ReactNode;
    content: ReactNode;
    id: string;
  }>;
  name?: string;
  className?: string;
}

const MutuallyExclusiveDetails: React.FC<MutuallyExclusiveDetailsProps> = ({ 
  items, 
  name = 'exclusive-details',
  className = '' 
}) => {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const handleToggle = (itemId: string, isOpen: boolean) => {
    if (isOpen) {
      setOpenItem(itemId);
    } else if (openItem === itemId) {
      setOpenItem(null);
    }
  };

  return (
    <div className={`mutually-exclusive-details ${className}`}>
      {items.map((item) => (
        <details
          key={item.id}
          name={name}
          open={openItem === item.id}
          onToggle={(e) => handleToggle(item.id, e.currentTarget.open)}
          className="border border-gray-200 rounded-lg mb-2 overflow-hidden"
        >
          <summary className="cursor-pointer px-4 py-3 bg-gray-50 hover:bg-gray-100 font-medium">
            {item.summary}
          </summary>
          <div className="px-4 py-3 bg-white">
            {item.content}
          </div>
        </details>
      ))}
    </div>
  );
};

// Modern HTML: Enhanced Dialog with modern features
interface ModernDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
  allowClose?: boolean;
}

const ModernDialog = forwardRef<HTMLDialogElement, ModernDialogProps>(({
  isOpen,
  onClose,
  children,
  title,
  className = '',
  allowClose = true
}, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (dialog.showModal) {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else {
      if (dialog.close) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (allowClose) {
        onClose();
      }
    };

    const handleCancel = (e: Event) => {
      if (allowClose) {
        onClose();
      } else {
        e.preventDefault();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose, allowClose]);

  const handleRequestClose = () => {
    const dialog = dialogRef.current;
    if (dialog && 'requestClose' in dialog) {
      // Modern dialog.requestClose() API
      (dialog as any).requestClose();
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && allowClose) {
      handleRequestClose();
    }
  };

  return (
    <dialog
      ref={(node) => {
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
        (dialogRef as any).current = node;
      }}
      className={`backdrop:bg-black backdrop:bg-opacity-50 bg-transparent max-w-lg w-full max-h-[80vh] overflow-auto ${className}`}
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 m-4" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            {allowClose && (
              <button
                onClick={handleRequestClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close dialog"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
});

ModernDialog.displayName = 'ModernDialog';

// Modern HTML: Enhanced image with lazy loading
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallback,
  className = '',
  onLoad,
  onError,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const supportsLazyLoading = 'loading' in HTMLImageElement.prototype;

  return (
    <div className={`relative ${className}`}>
      <img
        ref={imgRef}
        src={hasError && fallback ? fallback : src}
        alt={alt}
        loading={supportsLazyLoading ? 'lazy' : undefined}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
};

// Modern HTML: contenteditable with plaintext-only
interface PlaintextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const PlaintextEditor: React.FC<PlaintextEditorProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [supportsPlaintextOnly] = useState(() => {
    const div = document.createElement('div');
    div.contentEditable = 'plaintext-only';
    return div.contentEditable === 'plaintext-only';
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (editor.textContent !== value) {
      editor.textContent = value;
    }
  }, [value]);

  const handleInput = () => {
    const editor = editorRef.current;
    if (editor) {
      onChange(editor.textContent || '');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!supportsPlaintextOnly) {
      // Fallback: only allow plain text
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable={disabled ? 'false' : (supportsPlaintextOnly ? 'plaintext-only' : 'true')}
      className={`min-h-[40px] p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className} ${
        disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
      }`}
      onInput={handleInput}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      style={{
        ...(value === '' && placeholder ? {
          '::before': {
            content: `"${placeholder}"`,
            color: '#9CA3AF',
            pointerEvents: 'none'
          }
        } as any : {})
      }}
      suppressContentEditableWarning={true}
    />
  );
};

// Export all components
export {
  ModernPopover,
  MutuallyExclusiveDetails,
  ModernDialog,
  LazyImage,
  PlaintextEditor
}; 