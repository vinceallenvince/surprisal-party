import { ReactNode } from 'react';

export interface TypographyBaseProps {
  id?: string;
  className?: string;
  children: ReactNode;
}

export interface HeadingProps extends TypographyBaseProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export interface TextProps extends TypographyBaseProps {
  as?: 'p' | 'span' | 'div';
  variant?: 'normal' | 'small' | 'lead' | 'tiny';
} 