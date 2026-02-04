import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useSocket } from '../context/SocketContext';

const Navbar = ({ onMenuClick }) => {
  const { isConnected } = useSocket();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [notificationAnchor, setNotificationAnchor] = React.useState(null);

  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClick = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: '#161616',
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
          <img
            src="https://www.ibm.com/brand/experience-guides/developer/8f4e3cc2b5d52354a6d43c8edba1e3c9/01_8-bar-reverse.svg"
            alt="IBM"
            style={{ height: 24, marginRight: 12 }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            Watson Orchestrate
          </Typography>
        </Box>

        <Chip
          size="small"
          icon={<CircleIcon sx={{ fontSize: 10, color: isConnected ? '#24a148' : '#da1e28' }} />}
          label={isConnected ? 'Connected' : 'Disconnected'}
          sx={{
            ml: 2,
            backgroundColor: isConnected ? 'rgba(36, 161, 72, 0.1)' : 'rgba(218, 30, 40, 0.1)',
            color: isConnected ? '#24a148' : '#da1e28',
          }}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton color="inherit" onClick={handleNotificationClick}>
            <Badge badgeContent={3} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <IconButton color="inherit" href="/settings">
            <SettingsIcon />
          </IconButton>

          <IconButton onClick={handleProfileClick} sx={{ ml: 1 }}>
            <Avatar
              sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
            >
              A
            </Avatar>
          </IconButton>
        </Box>

        {/* Profile Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleClose}>Profile</MenuItem>
          <MenuItem onClick={handleClose}>Settings</MenuItem>
          <MenuItem onClick={handleClose}>Logout</MenuItem>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { width: 320, maxHeight: 400 } }}
        >
          <MenuItem onClick={handleClose}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Critical incident detected
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Database outage in production - 2 min ago
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem onClick={handleClose}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Workflow completed
              </Typography>
              <Typography variant="caption" color="text.secondary">
                INC-2024-001 resolved - 15 min ago
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem onClick={handleClose}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                New assignment
              </Typography>
              <Typography variant="caption" color="text.secondary">
                You've been assigned to INC-2024-003
              </Typography>
            </Box>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
