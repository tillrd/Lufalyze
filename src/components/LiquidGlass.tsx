import React, { useState, useEffect } from 'react';

// Core Liquid Glass Material Component
interface LiquidGlassProps {
  children: React.ReactNode;
  variant?: 'ultraThin' | 'thin' | 'regular' | 'thick' | 'ultraThick';
  elevation?: 'flat' | 'floating' | 'elevated' | 'floating-high';
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  rounded?: boolean; // New prop to control rounded corners
}

export const LiquidGlass: React.FC<LiquidGlassProps> = ({
  children,
  variant = 'regular',
  elevation = 'flat',
  interactive = false,
  className = '',
  onClick,
  rounded = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handleChange = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Throttled parallax effect on mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!interactive || reducedMotion) return;
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) / rect.width;
      const deltaY = (e.clientY - centerY) / rect.height;
      
      // Reduce intensity for better performance
      setMousePosition({ x: deltaX * 4, y: deltaY * 4 });
    });
  };

  const resetMousePosition = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  // Adaptive blur and opacity based on variant (improved readability)
  const getVariantStyles = () => {
    switch (variant) {
      case 'ultraThin':
        return 'bg-white/[0.85] dark:bg-gray-900/[0.85] backdrop-blur-xs backdrop-saturate-120';
      case 'thin':
        return 'bg-white/[0.9] dark:bg-gray-900/[0.9] backdrop-blur-sm backdrop-saturate-140';
      case 'regular':
        return 'bg-white/[0.95] dark:bg-gray-900/[0.95] backdrop-blur-md backdrop-saturate-140 backdrop-contrast-105';
      case 'thick':
        return 'bg-white/[0.97] dark:bg-gray-900/[0.97] backdrop-blur-lg backdrop-saturate-160 backdrop-contrast-110';
      case 'ultraThick':
        return 'bg-white/[0.98] dark:bg-gray-900/[0.98] backdrop-blur-xl backdrop-saturate-180 backdrop-contrast-115';
      default:
        return 'bg-white/[0.95] dark:bg-gray-900/[0.95] backdrop-blur-md backdrop-saturate-140';
    }
  };

  // Elevation-based shadows only (borders handled by glass-material)
  const getElevationStyles = () => {
    switch (elevation) {
      case 'flat':
        return 'shadow-glass-sm';
      case 'floating':
        return 'shadow-glass-md';
      case 'elevated':
        return 'shadow-glass-lg';
      case 'floating-high':
        return 'shadow-glass-xl';
      default:
        return 'shadow-glass-sm';
    }
  };

  // Interactive states (optimized for performance)
  const getInteractiveStyles = () => {
    if (!interactive) return '';
    
    return `
      cursor-pointer 
      transition-all duration-300 ease-out
      hover:shadow-glass-lg
      active:shadow-glass-md
      ${isHovered && !reducedMotion ? 'animate-glass-glow' : ''}
    `;
  };

  // Optimized transform style with reduced motion support
  const transformStyle = interactive && !reducedMotion ? {
    transform: `perspective(1000px) rotateX(${mousePosition.y * 0.25}deg) rotateY(${mousePosition.x * 0.25}deg) translateZ(0)`,
    transition: 'transform 0.2s ease-out',
    willChange: isHovered ? 'transform' : 'auto'
  } : {};

  return (
    <div
      className={`
        relative ${rounded ? 'rounded-3xl' : 'rounded-none'} overflow-hidden glass-material
        ${getVariantStyles()}
        ${getElevationStyles()}
        ${getInteractiveStyles()}
        ${className}
      `}
      style={transformStyle}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        resetMousePosition();
      }}
    >
      {/* Specular highlight overlay */}
      <div 
        className={`absolute inset-0 ${rounded ? 'rounded-3xl' : 'rounded-none'} pointer-events-none`}
        style={{
          background: `linear-gradient(135deg, 
            rgba(255, 255, 255, 0.35) 0%, 
            rgba(255, 255, 255, 0.1) 25%, 
            transparent 50%, 
            transparent 75%, 
            rgba(255, 255, 255, 0.05) 100%
          )`,
          mixBlendMode: 'overlay'
        }}
      />
      
      {/* Content with vibrancy */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Animated shimmer effect for interactive elements (respects reduced motion) */}
      {interactive && isHovered && !reducedMotion && (
        <div 
          className={`absolute inset-0 ${rounded ? 'rounded-3xl' : 'rounded-none'} pointer-events-none opacity-60`}
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
            animation: 'glassShimmer 2s ease-in-out infinite'
          }}
        />
      )}
    </div>
  );
};

// Floating Panel Component
interface FloatingPanelProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  onClose?: () => void;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  title,
  subtitle,
  className = '',
  onClose
}) => {
  return (
    <LiquidGlass 
      variant="regular" 
      elevation="floating" 
      className={`p-6 ${className}`}
    >
      {/* Header */}
      {(title || onClose) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {onClose && (
            <LiquidGlass 
              variant="ultraThin" 
              elevation="flat" 
              interactive 
              className="w-8 h-8 flex items-center justify-center"
              onClick={onClose}
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </LiquidGlass>
          )}
        </div>
      )}
      
      {/* Content */}
      <div>
        {children}
      </div>
    </LiquidGlass>
  );
};

// Glass Button Component
interface GlassButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  onClick
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-2 text-sm rounded-2xl';
      case 'md':
        return 'px-4 py-2.5 text-base rounded-2xl';
      case 'lg':
        return 'px-6 py-3 text-lg rounded-3xl';
      default:
        return 'px-4 py-2.5 text-base rounded-2xl';
    }
  };

  const getVariantMaterial = () => {
    switch (variant) {
      case 'primary':
        return 'thick';
      case 'secondary':
        return 'regular';
      case 'accent':
        return 'thin';
      default:
        return 'regular';
    }
  };

  return (
    <LiquidGlass
      variant={getVariantMaterial()}
      elevation="floating"
      interactive={!disabled}
      className={`
        glass-button
        ${getSizeStyles()}
        font-medium
        transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={disabled ? undefined : onClick}
    >
      <span className="flex items-center justify-center space-x-2 text-gray-900 dark:text-white">
        {children}
      </span>
    </LiquidGlass>
  );
};

// Layer Cake Stack Component
interface LayerCakeProps {
  layers: React.ReactNode[];
  className?: string;
}

export const LayerCake: React.FC<LayerCakeProps> = ({ layers, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      {layers.map((layer, index) => (
        <div
          key={index}
          className="relative"
          style={{
            zIndex: layers.length - index,
            marginTop: index > 0 ? '-1rem' : '0',
            marginLeft: `${index * 0.5}rem`,
            filter: `blur(${index * 1}px)`,
            opacity: 1 - (index * 0.15)
          }}
        >
          <LiquidGlass
            variant={index === 0 ? 'regular' : 'thin'}
            elevation={index === 0 ? 'floating' : 'flat'}
            className="w-full"
          >
            {layer}
          </LiquidGlass>
        </div>
      ))}
    </div>
  );
};

// Note: withReducedTransparency HOC removed to prevent React hook context issues 