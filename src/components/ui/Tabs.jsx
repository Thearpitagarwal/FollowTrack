import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

export function Tabs({ children, value, onValueChange }) {
  const [internalVal, setInternalVal] = useState(value || '');

  const activeValue = value !== undefined ? value : internalVal;
  const onChange = onValueChange || setInternalVal;

  return (
    <TabsContext.Provider value={{ activeValue, onChange }}>
      <div style={{ width: '100%' }}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, style }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-ink-10)', paddingBottom: '0.5rem', ...style }}>
      {children}
    </div>
  );
}

export function TabsTrigger({ children, value, style }) {
  const { activeValue, onChange } = useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      onClick={() => onChange(value)}
      style={{
        padding: '0.5rem 1rem',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-heading)',
        fontSize: '16px',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--color-ink)' : 'var(--color-ink-60)',
        opacity: isActive ? 1 : 0.6,
        borderBottom: isActive ? '2px solid var(--color-coral)' : '2px solid transparent',
        marginBottom: '-1px', // Pull it over the border
        transition: 'all 0.2s',
        ...style
      }}
    >
      {children}
    </button>
  );
}

export function TabsContent({ children, value }) {
  const { activeValue } = useContext(TabsContext);
  if (value !== activeValue) return null;
  
  return (
    <div className="animate-fade-up">
      {children}
    </div>
  );
}
