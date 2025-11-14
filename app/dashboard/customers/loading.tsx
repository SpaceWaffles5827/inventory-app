import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function CustomersLoading() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-8 py-8">
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="border-border/50">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-9 w-16 mb-2" />
                                <Skeleton className="h-3 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="border-border/50">
                    <CardHeader>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
