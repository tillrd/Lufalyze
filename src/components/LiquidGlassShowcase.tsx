import React, { useState } from 'react';
import { LiquidGlass, FloatingPanel, GlassButton, LayerCake } from './LiquidGlass';

const LiquidGlassShowcase: React.FC = () => {
  const [activeVariant, setActiveVariant] = useState<'ultraThin' | 'thin' | 'regular' | 'thick' | 'ultraThick'>('regular');
  const [activeElevation, setActiveElevation] = useState<'flat' | 'floating' | 'elevated' | 'floating-high'>('floating');
  const [showLayerCake, setShowLayerCake] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900 relative">
      {/* Ambient background elements */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-glass-float" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl animate-glass-float" style={{ animationDelay: '2s' }} />
      
      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Liquid Glass
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Apple's new translucent material language with adaptive vibrancy, specular highlights, and real-time depth
          </p>
        </div>

        {/* Interactive Controls */}
        <FloatingPanel title="🎛️ Interactive Controls" subtitle="Adjust material properties in real-time" className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Variant Controls */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Material Variant</h4>
              <div className="grid grid-cols-3 gap-2">
                {(['ultraThin', 'thin', 'regular', 'thick', 'ultraThick'] as const).map((variant) => (
                  <GlassButton
                    key={variant}
                    variant={activeVariant === variant ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setActiveVariant(variant)}
                  >
                    {variant}
                  </GlassButton>
                ))}
              </div>
            </div>

            {/* Elevation Controls */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Elevation Level</h4>
              <div className="grid grid-cols-2 gap-2">
                {(['flat', 'floating', 'elevated', 'floating-high'] as const).map((elevation) => (
                  <GlassButton
                    key={elevation}
                    variant={activeElevation === elevation ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setActiveElevation(elevation)}
                  >
                    {elevation}
                  </GlassButton>
                ))}
              </div>
            </div>
          </div>
        </FloatingPanel>

        {/* Live Material Demo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Live Material Preview</h3>
            <LiquidGlass
              variant={activeVariant}
              elevation={activeElevation}
              interactive
              className="p-8 h-64 flex items-center justify-center"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-glass-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {activeVariant} • {activeElevation}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Hover for parallax effect
                  </p>
                </div>
              </div>
            </LiquidGlass>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Material Properties</h3>
            <div className="space-y-3">
              {[
                { label: 'Backdrop Blur', value: activeVariant === 'ultraThin' ? '4px' : activeVariant === 'thin' ? '8px' : activeVariant === 'regular' ? '12px' : activeVariant === 'thick' ? '16px' : '24px' },
                { label: 'Saturation', value: activeVariant === 'ultraThin' ? '120%' : activeVariant === 'thin' ? '140%' : '140-180%' },
                { label: 'Opacity', value: '8-12%' },
                { label: 'Border Opacity', value: '5-15%' },
              ].map((prop) => (
                <LiquidGlass key={prop.label} variant="ultraThin" className="p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{prop.label}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{prop.value}</span>
                  </div>
                </LiquidGlass>
              ))}
            </div>
          </div>
        </div>

        {/* Component Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Button Variants */}
          <FloatingPanel title="🔘 Button Variants" subtitle="Interactive glass buttons">
            <div className="space-y-4">
              <GlassButton variant="primary" size="lg">Primary Action</GlassButton>
              <GlassButton variant="secondary" size="md">Secondary Action</GlassButton>
              <GlassButton variant="accent" size="sm">Accent Button</GlassButton>
              <GlassButton variant="primary" size="md" disabled>Disabled State</GlassButton>
            </div>
          </FloatingPanel>

          {/* Floating Panels */}
          <FloatingPanel 
            title="📋 Floating Panel" 
            subtitle="Self-contained glass panel"
            onClose={() => {}}
          >
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                This panel demonstrates the floating elevation with adaptive blur and vibrancy.
              </p>
              <LiquidGlass variant="thin" className="p-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Nested glass element</span>
                </div>
              </LiquidGlass>
            </div>
          </FloatingPanel>

          {/* Layer Cake Demo */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Layer Cake Stack</h4>
            <GlassButton
              variant="primary"
              onClick={() => setShowLayerCake(!showLayerCake)}
              className="mb-4"
            >
              {showLayerCake ? 'Hide' : 'Show'} Layer Cake
            </GlassButton>
            
            {showLayerCake && (
              <LayerCake
                layers={[
                  <div className="p-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white">Top Layer</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Primary content</p>
                  </div>,
                  <div className="p-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white">Middle Layer</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Secondary content</p>
                  </div>,
                  <div className="p-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white">Bottom Layer</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Background content</p>
                  </div>,
                ]}
              />
            )}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            {
              icon: '🌊',
              title: 'Adaptive Blur',
              description: 'Real-time backdrop filtering that adapts to content and performance'
            },
            {
              icon: '✨',
              title: 'Specular Highlights',
              description: 'Subtle light reflections along edges for authentic glass appearance'
            },
            {
              icon: '🎭',
              title: 'Vibrancy Effects',
              description: 'Text and elements use overlay blending for adaptive contrast'
            },
            {
              icon: '🎪',
              title: 'Parallax Motion',
              description: 'Device-tilt parallax on hover for spatial depth perception'
            }
          ].map((feature) => (
            <LiquidGlass key={feature.title} variant="regular" elevation="floating" interactive className="p-6">
              <div className="text-center space-y-3">
                <div className="text-3xl">{feature.icon}</div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{feature.title}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            </LiquidGlass>
          ))}
        </div>

        {/* Accessibility Note */}
        <FloatingPanel title="♿ Accessibility Features" subtitle="Inclusive design considerations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h5 className="font-medium text-gray-900 dark:text-white">Automatic Fallbacks</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Respects prefers-reduced-transparency</li>
                <li>• Fallback for browsers without backdrop-filter</li>
                <li>• High contrast mode support</li>
                <li>• Reduced motion preferences</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h5 className="font-medium text-gray-900 dark:text-white">Performance</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Mobile-optimized blur levels</li>
                <li>• Hardware acceleration enabled</li>
                <li>• Efficient CSS custom properties</li>
                <li>• Progressive enhancement approach</li>
              </ul>
            </div>
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
};

export default LiquidGlassShowcase; 