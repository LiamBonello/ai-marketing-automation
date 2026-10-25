'use client';

import { alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: '#5B4CF0',
      dark: '#4335CE',
      light: '#857AF6',
    },
    secondary: {
      main: '#15A37D',
    },
    background: {
      default: '#F7F8FB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#171923',
      secondary: '#667085',
    },
    divider: '#EAECF0',
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: 'clamp(2rem, 4vw, 3.4rem)',
      fontWeight: 760,
      lineHeight: 1.05,
      letterSpacing: '-0.04em',
    },
    h2: {
      fontSize: 'clamp(1.6rem, 3vw, 2.3rem)',
      fontWeight: 720,
      lineHeight: 1.1,
      letterSpacing: '-0.035em',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 18,
          minHeight: 42,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #EAECF0',
          boxShadow: `0 18px 45px ${alpha('#101828', 0.06)}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 18,
        },
      },
    },
  },
});

export default theme;
