// Notification.js — mirrors Student.js patterns/style
import React, { useState, useEffect } from 'react';
import './Notification.css';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Button,
  Heading,
  Input,
  Textarea,
  Select,
  FormLabel,
  FormControl,
  VStack,
  HStack,
  useToast,
  Text,
  Tag,
  Card,
  CardHeader,
  CardBody,
  Stack,
  Heading as ChakraHeading,
} from '@chakra-ui/react';
import LoadingSpinner from './components/LoadingSpinner';
import EmptyState from './components/EmptyState';

function Notification() {
  const [notificationData, setNotificationData] = useState({
    title: '',
    message: '',
    postedBy: '',
    audience: 'All',
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const API_BASE_URL = '/api';

  const getData = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/notification`)
      .then((res) => res.json())
      .then((res) => {
        console.log('Fetched notifications:', res);
        setData(res || []);
      })
      .catch(() => toast({ title: 'Failed to load notifications', status: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getData();
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNotificationData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationData),
    };
    fetch(`${API_BASE_URL}/addnotification`, requestOptions)
      .then((res) => res.json())
      .then(() => {
        toast({ title: 'Notification posted', status: 'success' });
        setNotificationData({ title: '', message: '', postedBy: '', audience: 'All' });
        getData();
      })
      .catch(() => toast({ title: 'Error posting notification', status: 'error' }));
  };

  const handleDelete = (id) => {
    fetch(`${API_BASE_URL}/notification/${id}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then(() => {
        toast({ title: 'Deleted', status: 'info' });
        getData();
      })
      .catch(() => toast({ title: 'Delete failed', status: 'error' }));
  };

  return (
    <Box>
      <Helmet>
        <title>Notifications • Student–Teacher Portal</title>
      </Helmet>

      <Heading mb={6}>Post a Notification</Heading>

      <Box as="form" onSubmit={handleSubmit} mb={8} maxW="lg">
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>Title</FormLabel>
            <Input
              name="title"
              value={notificationData.title}
              onChange={handleChange}
              placeholder="e.g. Exam schedule released"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Message</FormLabel>
            <Textarea
              name="message"
              value={notificationData.message}
              onChange={handleChange}
              placeholder="Write the announcement..."
            />
          </FormControl>

          <FormControl>
            <FormLabel>Posted By</FormLabel>
            <Input
              name="postedBy"
              value={notificationData.postedBy}
              onChange={handleChange}
              placeholder="e.g. Admin, Principal"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Audience</FormLabel>
            <Select name="audience" value={notificationData.audience} onChange={handleChange}>
              <option value="All">All</option>
              <option value="Students">Students</option>
              <option value="Teachers">Teachers</option>
            </Select>
          </FormControl>

          <HStack>
            <Button type="submit" colorScheme="teal">
              Post
            </Button>
          </HStack>
        </VStack>
      </Box>

      {loading ? (
        <LoadingSpinner />
      ) : data.length === 0 ? (
        <EmptyState title="No notifications" subtitle="Post your first announcement to see it here." />
      ) : (
        <Stack spacing={4} maxW="2xl">
          {data.map((d, i) => {
            const id = d.id || i;
            const title = d.title || 'Untitled';
            const message = d.message || '';
            const postedBy = d.posted_by || d.postedBy || 'Admin';
            const audience = d.audience || 'All';
            const createdAt = d.created_at
              ? new Date(d.created_at).toLocaleString()
              : '';

            return (
              <Card key={id} variant="outline">
                <CardHeader pb={0}>
                  <HStack justify="space-between" align="start">
                    <ChakraHeading size="md">{title}</ChakraHeading>
                    <Tag colorScheme="purple">{audience}</Tag>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Text mb={2}>{message}</Text>
                  <Text fontSize="sm" color="gray.500">
                    Posted by {postedBy} {createdAt && `• ${createdAt}`}
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    colorScheme="red"
                    mt={3}
                    onClick={() => handleDelete(id)}
                  >
                    Delete
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

export default Notification;
