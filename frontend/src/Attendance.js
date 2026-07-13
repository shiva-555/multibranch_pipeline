// Attendance.js — mirrors Student.js patterns/style
import React, { useState, useEffect } from 'react';
import './Attendance.css';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Button,
  Heading,
  Input,
  Select,
  FormLabel,
  FormControl,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  VStack,
  HStack,
  useToast,
  Text,
  Tag,
} from '@chakra-ui/react';
import LoadingSpinner from './components/LoadingSpinner';
import EmptyState from './components/EmptyState';

function Attendance() {
  const [attendanceData, setAttendanceData] = useState({
    studentName: '',
    rollNo: '',
    class: '',
    date: '',
    status: 'Present',
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const API_BASE_URL = '/api';

  const getData = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/attendance`)
      .then((res) => res.json())
      .then((res) => {
        console.log('Fetched attendance:', res);
        setData(res || []);
      })
      .catch(() => toast({ title: 'Failed to load attendance', status: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getData();
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAttendanceData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceData),
    };
    fetch(`${API_BASE_URL}/addattendance`, requestOptions)
      .then((res) => res.json())
      .then(() => {
        toast({ title: 'Attendance recorded', status: 'success' });
        setAttendanceData({ studentName: '', rollNo: '', class: '', date: '', status: 'Present' });
        getData();
      })
      .catch(() => toast({ title: 'Error recording attendance', status: 'error' }));
  };

  const handleDelete = (id) => {
    fetch(`${API_BASE_URL}/attendance/${id}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then(() => {
        toast({ title: 'Deleted', status: 'info' });
        getData();
      })
      .catch(() => toast({ title: 'Delete failed', status: 'error' }));
  };

  const statusColor = (status) => {
    if (status === 'Present') return 'green';
    if (status === 'Absent') return 'red';
    return 'orange'; // Late
  };

  return (
    <Box>
      <Helmet>
        <title>Attendance • Student–Teacher Portal</title>
      </Helmet>

      <Heading mb={6}>Mark Attendance</Heading>

      <Box as="form" onSubmit={handleSubmit} mb={8} maxW="lg">
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>Student Name</FormLabel>
            <Input
              name="studentName"
              value={attendanceData.studentName}
              onChange={handleChange}
              placeholder="Enter student name"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Roll No</FormLabel>
            <Input
              name="rollNo"
              value={attendanceData.rollNo}
              onChange={handleChange}
              placeholder="Enter roll number"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Class</FormLabel>
            <Input
              name="class"
              value={attendanceData.class}
              onChange={handleChange}
              placeholder="Enter class"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Date</FormLabel>
            <Input
              type="date"
              name="date"
              value={attendanceData.date}
              onChange={handleChange}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Status</FormLabel>
            <Select name="status" value={attendanceData.status} onChange={handleChange}>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
            </Select>
          </FormControl>

          <HStack>
            <Button type="submit" colorScheme="teal">
              Save
            </Button>
          </HStack>
        </VStack>
      </Box>

      {loading ? (
        <LoadingSpinner />
      ) : data.length === 0 ? (
        <EmptyState title="No attendance records" subtitle="Mark your first attendance entry to see it here." />
      ) : (
        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Roll No</Th>
                <Th>Name</Th>
                <Th>Class</Th>
                <Th>Status</Th>
                <Th textAlign="center">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.map((d, i) => {
                const roll = d.roll_number || d.rollNo || `#${i + 1}`;
                const name = d.student_name || d.studentName || '—';
                const className = d.class || d.Class || '—';
                const date = d.attendance_date
                  ? new Date(d.attendance_date).toISOString().slice(0, 10)
                  : d.date || '—';
                const status = d.status || 'Present';
                const id = d.id || i;

                return (
                  <Tr key={id}>
                    <Td>{date}</Td>
                    <Td fontWeight="bold">{roll}</Td>
                    <Td>{name}</Td>
                    <Td>{className}</Td>
                    <Td>
                      <Tag colorScheme={statusColor(status)}>{status}</Tag>
                    </Td>
                    <Td textAlign="center">
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="red"
                        onClick={() => handleDelete(id)}
                      >
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <Text mt={3} fontSize="sm" color="gray.500">
            Showing {data.length} record{data.length > 1 ? 's' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default Attendance;
