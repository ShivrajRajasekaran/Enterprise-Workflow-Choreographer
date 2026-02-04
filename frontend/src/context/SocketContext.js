import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const SocketContext = createContext(null);

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [workflowUpdates, setWorkflowUpdates] = useState([]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      // Only show toast once on initial connection, not on reconnects
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Workflow events
    newSocket.on('workflow:started', (data) => {
      console.log('Workflow started:', data);
      toast.info(`Workflow started: ${data.incidentId}`, { autoClose: 3000 });
      setWorkflowUpdates(prev => [...prev, { type: 'started', ...data }]);
    });

    newSocket.on('workflow:step:started', (data) => {
      console.log('Workflow step started:', data);
      setWorkflowUpdates(prev => [...prev, { type: 'step:started', ...data }]);
    });

    newSocket.on('workflow:step:completed', (data) => {
      console.log('Workflow step completed:', data);
      // Reduced toasts to prevent UI shaking
      setWorkflowUpdates(prev => [...prev, { type: 'step:completed', ...data }]);
    });

    newSocket.on('workflow:step:failed', (data) => {
      console.log('Workflow step failed:', data);
      toast.error(`Step failed: ${data.stepName}`, { autoClose: 4000 });
      setWorkflowUpdates(prev => [...prev, { type: 'step:failed', ...data }]);
    });

    newSocket.on('workflow:completed', (data) => {
      console.log('Workflow completed:', data);
      toast.success(`Workflow completed for incident ${data.incidentId}`, { autoClose: 4000 });
      setWorkflowUpdates(prev => [...prev, { type: 'completed', ...data }]);
    });

    // Incident events
    newSocket.on('incident:created', (data) => {
      toast.info(`New incident: ${data.title}`, { autoClose: 3000 });
    });

    newSocket.on('incident:updated', (data) => {
      console.log('Incident updated:', data.id);
      // Don't show toast for every update to prevent UI shaking
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const clearWorkflowUpdates = () => {
    setWorkflowUpdates([]);
  };

  const value = {
    socket,
    isConnected,
    workflowUpdates,
    clearWorkflowUpdates,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
