import React from 'react';
import type { ToolDefinition } from '../../types';
import './ToolInventory.css';

interface ToolInventoryProps {
  tools: ToolDefinition[];
  calledToolNames: string[];
}

const ToolIcon: React.FC<{ name: string }> = ({ name }) => {
  switch (name) {
    case 'search_knowledge_base':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'get_product_details':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'compare_products':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'calculate_price':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'check_warranty_status':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
  }
};

const ToolInventory: React.FC<ToolInventoryProps> = ({ tools, calledToolNames }) => {
  if (tools.length === 0) return null;

  return (
    <div className="tool-inventory">
      <div className="tool-inventory-label">Available Tools</div>
      <div className="tool-inventory-list">
        {tools.map((tool) => {
          const wasCalled = calledToolNames.includes(tool.name);
          return (
            <div
              key={tool.name}
              className={`tool-inventory-item ${wasCalled ? 'tool-inventory-item-used' : ''}`}
            >
              <span className="tool-inventory-icon">
                <ToolIcon name={tool.name} />
              </span>
              <div className="tool-inventory-text">
                <span className="tool-inventory-name">{formatToolName(tool.name)}</span>
                <span className="tool-inventory-desc">{tool.description}</span>
              </div>
              {wasCalled && <span className="tool-inventory-badge">Used</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default ToolInventory;
