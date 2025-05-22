declare module 'react-native-svg-charts' {
  import * as React from 'react';
  import { ViewStyle, StyleProp } from 'react-native';
  import { SvgProps } from 'react-native-svg';

  export interface BarChartProps {
    data: number[] | { value: number }[];
    style?: StyleProp<ViewStyle>;
    svg?: Partial<SvgProps> | ((value: number, index: number) => Partial<SvgProps>);
    contentInset?: { top?: number; bottom?: number; left?: number; right?: number };
    spacingInner?: number;
    spacingOuter?: number;
    gridMin?: number;
    gridMax?: number;
    horizontal?: boolean;
    yAccessor?: (props: { item: any; index: number }) => number;
    xAccessor?: (props: { item: any; index: number }) => number;
    numberOfTicks?: number;
    children?: React.ReactNode;
  }

  export class BarChart extends React.Component<BarChartProps> {}

  export interface XAxisProps {
    data: any[];
    formatLabel?: (value: any, index: number) => string;
    style?: StyleProp<ViewStyle>;
    contentInset?: { left?: number; right?: number };
    svg?: Partial<SvgProps>;
    numberOfTicks?: number;
  }

  export class XAxis extends React.Component<XAxisProps> {}
}