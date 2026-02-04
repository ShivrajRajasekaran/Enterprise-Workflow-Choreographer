import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Report as ReportIcon,
  AccountTree as WorkflowIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';

const drawerWidth = 240;
const miniDrawerWidth = 64;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Incidents', icon: <ReportIcon />, path: '/incidents' },
  { text: 'Workflows', icon: <WorkflowIcon />, path: '/workflows' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const integrationItems = [
  { text: 'ServiceNow', icon: '🎫', path: '#' },
  { text: 'Slack', icon: '💬', path: '#' },
  { text: 'GitHub', icon: <GitHubIcon />, path: '#' },
  { text: 'Confluence', icon: '📄', path: '#' },
  { text: 'Jira', icon: '📋', path: '#' },
];

const Sidebar = ({ open }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? drawerWidth : miniDrawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : miniDrawerWidth,
          boxSizing: 'border-box',
          mt: 8,
          backgroundColor: '#262626',
          color: '#f4f4f4',
          transition: 'width 0.3s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2, display: open ? 'block' : 'none' }}>
        <Typography variant="caption" sx={{ color: '#8d8d8d', textTransform: 'uppercase' }}>
          Navigation
        </Typography>
      </Box>

      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
                '&.Mui-selected': {
                  backgroundColor: '#0f62fe',
                  '&:hover': {
                    backgroundColor: '#0353e9',
                  },
                },
                '&:hover': {
                  backgroundColor: '#393939',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                  color: location.pathname === item.path ? '#fff' : '#c6c6c6',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {open && (
        <>
          <Divider sx={{ borderColor: '#393939', my: 2 }} />

          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="caption" sx={{ color: '#8d8d8d', textTransform: 'uppercase' }}>
              Integrations
            </Typography>
          </Box>

          <List>
            {integrationItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  sx={{
                    minHeight: 40,
                    px: 2.5,
                    '&:hover': {
                      backgroundColor: '#393939',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 3,
                      justifyContent: 'center',
                      color: '#c6c6c6',
                      fontSize: typeof item.icon === 'string' ? 18 : undefined,
                    }}
                  >
                    {typeof item.icon === 'string' ? item.icon : item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {open && (
        <Box sx={{ p: 2 }}>
          <ListItemButton
            sx={{
              borderRadius: 1,
              backgroundColor: '#393939',
              '&:hover': { backgroundColor: '#4c4c4c' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: '#c6c6c6' }}>
              <HelpIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Help & Support"
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItemButton>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar;
