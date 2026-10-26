'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AppLink from './AppLink';

const drawerWidth = 244;

const navigation = [
  { label: 'Assistant', href: '/', icon: <AutoAwesomeRoundedIcon fontSize="small" /> },
  { label: 'Campaigns', href: '/campaigns', icon: <CampaignRoundedIcon fontSize="small" /> },
  { label: 'Results', href: '/results', icon: <InsightsRoundedIcon fontSize="small" /> },
  { label: 'My business', href: '/business', icon: <BusinessRoundedIcon fontSize="small" /> },
] as const;

interface AppShellProps {
  children: React.ReactNode;
  identity: {
    name: string;
    businessName: string;
    planName: string;
  };
  demo?: boolean;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppShell({ children, identity, demo = false }: Readonly<AppShellProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (demo || loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const drawer = (
    <Stack sx={{ height: '100%', px: 2, py: 2.5 }}>
      <Stack direction="row" spacing={1.2} sx={{ px: 1, mb: 3, alignItems: 'center' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: 'common.white',
            background: 'linear-gradient(135deg, #5B4CF0 0%, #8B5CF6 100%)',
          }}
        >
          <AutoAwesomeRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            MarketPilot
          </Typography>
          <Typography variant="caption" color="text.secondary">
            AI marketing assistant
          </Typography>
        </Box>
      </Stack>

      <Button
        component={AppLink}
        href="/"
        variant="contained"
        startIcon={<AddRoundedIcon />}
        fullWidth
        sx={{ mb: 2.5 }}
      >
        New campaign
      </Button>

      <List sx={{ p: 0 }}>
        {navigation.map((item) => {
          const selected = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <ListItemButton
              key={item.href}
              component={AppLink}
              href={item.href}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2.5,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'rgba(91, 76, 240, 0.09)',
                  color: 'primary.main',
                },
                '&.Mui-selected:hover': {
                  bgcolor: 'rgba(91, 76, 240, 0.12)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { fontWeight: 650 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={1.2} sx={{ px: 1, alignItems: 'center' }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'grey.900', fontSize: 14 }}>
          {initials(identity.name || identity.businessName) || 'MP'}
        </Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
            {identity.businessName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {identity.planName} plan
          </Typography>
        </Box>
        {!demo && (
          <Tooltip title="Sign out">
            <IconButton
              size="small"
              onClick={() => void logout()}
              disabled={loggingOut}
              aria-label="Sign out"
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          display: { md: 'none' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <MenuRoundedIcon />
          </IconButton>
          <Typography sx={{ ml: 1, fontWeight: 800 }}>MarketPilot</Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              borderRightColor: 'divider',
              bgcolor: '#FBFBFD',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          pt: { xs: 9, md: 0 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
