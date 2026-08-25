export { COLORS, FONTS, SPACING, RADIUS } from './theme';
import { COLORS } from './theme';

const Colors = {
  light: {
    text: COLORS.dark,
    background: COLORS.background,
    tint: COLORS.primary,
  },
  dark: {
    text: COLORS.white,
    background: COLORS.dark,
    tint: COLORS.primary,
  },
};

export default Colors;
