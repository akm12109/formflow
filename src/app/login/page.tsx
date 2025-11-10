'use client';

import { useState } from 'react';
import { BotMessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { auth, db } from '@/firebase';
import {
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

const requestFormSchema = z.object({
    name: z.string().min(1, { message: 'Name is required.' }),
    email: z.string().email({ message: 'A valid email is required.' }),
    phone: z.string().min(10, { message: 'A valid phone number is required.'}),
    useCase: z.string().min(10, { message: 'Use case must be at least 10 characters.' }),
    message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

function AccessRequestForm({onClose}: {onClose: () => void}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const requestForm = useForm<z.infer<typeof requestFormSchema>>({
        resolver: zodResolver(requestFormSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            useCase: '',
            message: '',
        },
    });

    const handleRequestSubmit = async (values: z.infer<typeof requestFormSchema>) => {
        setLoading(true);
        try {
            await addDoc(collection(db, 'accessRequests'), {
                ...values,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            toast({
                title: 'Request Sent',
                description: 'Your request for access has been submitted successfully.',
            });
            onClose();
        } catch (error) {
            console.error("Error submitting access request: ", error);
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: 'Failed to submit your request. Please try again later.',
            });
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Form {...requestForm}>
            <form onSubmit={requestForm.handleSubmit(handleRequestSubmit)} className="space-y-4">
                <FormField
                    control={requestForm.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                                <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={requestForm.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                                <Input placeholder="name@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={requestForm.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                                <Input placeholder="+1 (555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={requestForm.control}
                    name="useCase"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Primary Use Case</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., Automating data entry for my clients..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={requestForm.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Additional Message</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Tell us anything else that might be relevant..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
            </form>
        </Form>
    );
}

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSignIn = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      toast({
        title: 'Signed In',
        description: 'You have successfully signed in.',
      });

      if (userCredential.user.email === 'admin@akm.com') {
        router.push('/admin');
      } else {
        router.push('/');
      }

    } catch (error: any) {
      console.error('Error signing in: ', error);
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description:
          error.code === 'auth/invalid-credential'
            ? 'Invalid email or password.'
            : 'Failed to sign in. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <BotMessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tighter text-foreground">Welcome to FormFlow AI</h1>
            <p className="mt-2 text-muted-foreground">Sign in to automate your world.</p>
        </div>
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Secure Sign In</CardTitle>
                <CardDescription>
                    Enter your credentials to access your dashboard.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                    onSubmit={form.handleSubmit(handleSignIn)}
                    className="space-y-4"
                    >
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                            <Input
                                placeholder="name@example.com"
                                {...field}
                                type="email"
                            />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                            <Input
                                placeholder="••••••••"
                                {...field}
                                type="password"
                            />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </Button>
                    </form>
                </Form>
                <div className="mt-4 text-center text-sm">
                    Don&apos;t have an account?{' '}
                    <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                        <DialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto">Request Access</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                            <DialogTitle>Request Access</DialogTitle>
                            <DialogDescription>
                                Fill out the form below and an admin will review your request.
                            </DialogDescription>
                            </DialogHeader>
                            <AccessRequestForm onClose={() => setIsRequestOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
