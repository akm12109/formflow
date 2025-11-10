'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/app/header';
import { useCollection } from '@/firebase/firestore/use-collection';
import { db, functions } from '@/firebase';
import { collection, query, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import withAuth from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ServerCrash, Mail, UserPlus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { UserPresence } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { httpsCallable } from 'firebase/functions';

type AccessRequest = {
    id: string;
    name: string;
    email: string;
    phone: string;
    useCase: string;
    message: string;
    status: 'pending' | 'approved' | 'denied';
    createdAt: Timestamp;
    newUserEmail?: string;
    newUserPassword?: string;
};

function AdminDashboard() {
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserPresence | null>(null);
  
  const requestsQuery = useMemo(() => query(collection(db, "accessRequests"), orderBy("createdAt", "desc")), []);
  const { data: requests, loading: requestsLoading, error: requestsError } = useCollection<AccessRequest>(requestsQuery);

  const presenceQuery = useMemo(() => query(collection(db, "userPresence"), orderBy("lastSeen", "desc")), []);
  const { data: presence, loading: presenceLoading, error: presenceError } = useCollection<UserPresence>(presenceQuery);
  
  const openCreateUserDialog = (request: AccessRequest) => {
    setSelectedRequest(request);
    setNewUserEmail(request.email); // Pre-fill email
    setNewUserPassword(generatePassword()); // Pre-fill with a random password
    setIsCreateUserOpen(true);
  };

  const openDeleteUserDialog = (user: UserPresence) => {
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
  };
  
  const generatePassword = () => {
    return Math.random().toString(36).slice(-8);
  };

  const handleCreateUser = async () => {
    if (!selectedRequest || !newUserEmail || !newUserPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Email and password are required.' });
      return;
    }
    setLoadingAction(selectedRequest.id);
    try {
        const createUser = httpsCallable(functions, 'createUser');
        await createUser({ email: newUserEmail, password: newUserPassword });

        const requestRef = doc(db, 'accessRequests', selectedRequest.id);
        await updateDoc(requestRef, { 
          status: 'approved',
          newUserEmail: newUserEmail,
          newUserPassword: newUserPassword // Storing temporarily for the mailto link
        });
        
        toast({
            title: 'User Created & Approved',
            description: `User ${newUserEmail} has been created.`,
        });
    } catch (error: any) {
        console.error("Error creating user: ", error);
        toast({
            variant: 'destructive',
            title: 'Creation Error',
            description: error.message || 'Failed to create user.',
        });
    } finally {
        setLoadingAction(null);
        setIsCreateUserOpen(false);
        setSelectedRequest(null);
    }
  };


  const handleStatusChange = async (id: string, status: 'denied') => {
    setLoadingAction(id);
    try {
        const requestRef = doc(db, 'accessRequests', id);
        await updateDoc(requestRef, { status });
        toast({
            title: 'Status Updated',
            description: `Request has been marked as ${status}.`,
        });
    } catch (error) {
        console.error("Error updating status: ", error);
        toast({
            variant: 'destructive',
            title: 'Update Error',
            description: 'Failed to update request status.',
        });
    } finally {
        setLoadingAction(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setLoadingAction(userToDelete.id);
    try {
      const deleteUser = httpsCallable(functions, 'deleteUser');
      await deleteUser({ uid: userToDelete.id });

      // Also delete their presence doc
      await deleteDoc(doc(db, 'userPresence', userToDelete.id));

      toast({
        title: 'User Deleted',
        description: `User ${userToDelete.email} has been permanently deleted.`,
      });
    } catch (error: any) {
      console.error("Error deleting user: ", error);
      toast({
        variant: 'destructive',
        title: 'Deletion Error',
        description: error.message || 'Failed to delete user.',
      });
    } finally {
      setLoadingAction(null);
      setIsDeleteUserOpen(false);
      setUserToDelete(null);
    }
  };


  const handleNotify = (request: AccessRequest) => {
    const subject = encodeURIComponent("Your Access to FormFlow AI is Ready!");
    const body = encodeURIComponent(
        `Hello ${request.name},\n\n`+
        `Welcome to FormFlow AI! Your request for access has been approved.\n\n`+
        `You can now log in with the following credentials:\n`+
        `Email: ${request.newUserEmail}\n`+
        `Password: ${request.newUserPassword}\n\n`+
        `Login URL: ${window.location.origin}/login\n\n`+
        `If you have any issues, please contact support.\n\n`+
        `Best regards,\nThe FormFlow AI Team`
    );
    window.location.href = `mailto:${request.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-1">
            <Card>
                <CardHeader>
                    <CardTitle>Admin Panel: Access Requests</CardTitle>
                    <CardDescription>
                        Review and manage user requests for application access.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {requestsLoading && (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    )}
                    {requestsError && (
                         <Alert variant="destructive">
                            <ServerCrash className="h-4 w-4" />
                            <AlertTitle>Error Loading Requests</AlertTitle>
                            <AlertDescription>
                                Could not load access requests. Please check the console for more details.
                            </AlertDescription>
                        </Alert>
                    )}
                    {!requestsLoading && !requestsError && requests && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Use Case</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.length > 0 ? requests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell>{format(request.createdAt.toDate(), 'PPP')}</TableCell>
                                        <TableCell className="font-medium">{request.name}</TableCell>
                                        <TableCell>{request.email}</TableCell>
                                        <TableCell className="max-w-xs truncate">{request.useCase}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                request.status === 'pending' ? 'secondary' : 
                                                request.status === 'approved' ? 'default' : 'destructive'
                                            }>
                                                {request.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {request.status === 'pending' && (
                                              <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => openCreateUserDialog(request)} disabled={loadingAction === request.id}>
                                                    <UserPlus className="mr-2 h-4 w-4" /> Approve
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => handleStatusChange(request.id, 'denied')} disabled={loadingAction === request.id}>
                                                    Deny
                                                </Button>
                                              </div>
                                            )}
                                            {request.status === 'approved' && (
                                                <Button variant="outline" size="sm" onClick={() => handleNotify(request)}>
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    Notify User
                                                </Button>
                                            )}
                                            {request.status === 'denied' && (
                                                <span className="text-muted-foreground text-xs">No actions</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">No access requests found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                        View user activity and manage existing users.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {presenceLoading && (
                        <div className="space-y-2">
                             {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    )}
                    {presenceError && (
                         <Alert variant="destructive">
                            <ServerCrash className="h-4 w-4" />
                            <AlertTitle>Error Loading Activity</AlertTitle>
                            <AlertDescription>
                                Could not load user activity. Please check console for details.
                            </AlertDescription>
                        </Alert>
                    )}
                    {!presenceLoading && !presenceError && presence && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Last Seen</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                               {presence.length > 0 ? presence.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.email}</TableCell>
                                        <TableCell className="text-muted-foreground">{p.id}</TableCell>
                                        <TableCell>
                                            {p.lastSeen ? format(p.lastSeen.toDate(), 'PPP ppp') : 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {p.email !== 'admin@akm.com' && (
                                                 <Button variant="destructive" size="sm" onClick={() => openDeleteUserDialog(p)} disabled={loadingAction === p.id}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center">No user activity recorded yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

        </div>
        <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create User for {selectedRequest?.name}</DialogTitle>
                    <DialogDescription>
                        Enter the credentials for the new user. An auto-generated password is provided.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                            Password
                        </Label>
                        <Input
                            id="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateUser} disabled={loadingAction === selectedRequest?.id}>
                        {loadingAction === selectedRequest?.id ? 'Creating...' : 'Create and Approve'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <AlertDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the user account
                        for <span className="font-semibold">{userToDelete?.email}</span> and remove their data from our servers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDeleteUser}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={loadingAction === userToDelete?.id}
                    >
                        {loadingAction === userToDelete?.id ? 'Deleting...' : 'Yes, delete user'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

export default withAuth(AdminDashboard);
