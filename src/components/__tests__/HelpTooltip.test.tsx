import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpTooltip, LabelWithHelp } from '../ui/HelpTooltip';

// Mock Radix UI tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe('HelpTooltip', () => {
  it('renders help button', () => {
    render(<HelpTooltip content="Help text" />);
    expect(screen.getByRole('button', { name: /help information/i })).toBeInTheDocument();
  });

  it('renders tooltip content', () => {
    render(<HelpTooltip content="This is helpful information" />);
    expect(screen.getByText('This is helpful information')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<HelpTooltip content="Help" className="custom-class" />);
    const button = screen.getByRole('button', { name: /help information/i });
    expect(button).toHaveClass('custom-class');
  });

  it('renders with HelpCircle icon', () => {
    render(<HelpTooltip content="Help text" />);
    const button = screen.getByRole('button', { name: /help information/i });
    expect(button.querySelector('svg')).toBeInTheDocument();
  });
});

describe('LabelWithHelp', () => {
  it('renders label text', () => {
    render(<LabelWithHelp label="Field Label" helpText="Help for field" />);
    expect(screen.getByText('Field Label')).toBeInTheDocument();
  });

  it('renders help tooltip', () => {
    render(<LabelWithHelp label="Field Label" helpText="Help for field" />);
    expect(screen.getByText('Help for field')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    render(<LabelWithHelp label="Required Field" helpText="Help" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not show required indicator when not required', () => {
    render(<LabelWithHelp label="Optional Field" helpText="Help" />);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('associates label with htmlFor', () => {
    render(<LabelWithHelp label="Field" helpText="Help" htmlFor="field-id" />);
    const label = screen.getByText('Field');
    expect(label).toHaveAttribute('for', 'field-id');
  });

  it('applies custom className', () => {
    const { container } = render(
      <LabelWithHelp label="Field" helpText="Help" className="my-custom-class" />
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
