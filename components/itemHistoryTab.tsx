"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRightLeft, History } from "lucide-react"
import type { ItemWithDetails } from "@/lib/api/items.api"

type TransactionWithUser = ItemWithDetails['transactions'][number]

interface ItemHistoryTabProps {
    transactions: TransactionWithUser[]
}

export function ItemHistoryTab({ transactions }: ItemHistoryTabProps) {
    return (
        <div className="bg-card overflow-hidden">
            <div className="p-4 border-b">
                <h3 className="text-base font-semibold">Transaction History</h3>
            </div>
            {transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Type</TableHead>
                                <TableHead className="text-xs">Details</TableHead>
                                <TableHead className="text-xs text-right">Qty</TableHead>
                                <TableHead className="text-xs hidden sm:table-cell">User</TableHead>
                                <TableHead className="text-xs">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.slice(0, 20).map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded ${transaction.type === "INPUT"
                                                    ? "bg-green-50"
                                                    : transaction.type === "OUTPUT"
                                                        ? "bg-red-50"
                                                        : "bg-blue-50"
                                                }`}>
                                                {transaction.type === "TRANSFER" ? (
                                                    <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
                                                ) : (
                                                    <History className={`h-3.5 w-3.5 ${transaction.type === "INPUT" ? "text-green-600" : "text-red-600"
                                                        }`} />
                                                )}
                                            </div>
                                            <span className="text-sm hidden md:inline">
                                                {transaction.type === "INPUT"
                                                    ? "Stock Added"
                                                    : transaction.type === "OUTPUT"
                                                        ? "Stock Removed"
                                                        : "Transfer"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {transaction.type === "TRANSFER" ? (
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-muted-foreground">To:</span>
                                                    <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                                                        {transaction.toLocation?.code || "Unknown"}
                                                    </code>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-muted-foreground">From:</span>
                                                    <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                                                        {transaction.fromLocation?.code || "Unknown"}
                                                    </code>
                                                </div>
                                                {transaction.reason && !transaction.reason.startsWith("Transfer:") && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                                                        {transaction.reason}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-0.5">
                                                {transaction.fromLocationId && (
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span className="text-muted-foreground">Location:</span>
                                                        <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                                                            {transaction.fromLocation?.code || transaction.toLocation?.code || "Unknown"}
                                                        </code>
                                                    </div>
                                                )}
                                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {transaction.reason || "—"}
                                                </p>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span
                                            className={`text-sm font-semibold ${transaction.type === "INPUT"
                                                    ? "text-green-600"
                                                    : transaction.type === "OUTPUT"
                                                        ? "text-red-600"
                                                        : "text-blue-600"
                                                }`}
                                        >
                                            {transaction.type === "INPUT"
                                                ? "+"
                                                : transaction.type === "OUTPUT"
                                                    ? "-"
                                                    : ""}
                                            {transaction.quantity}
                                        </span>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        <span className="text-sm text-muted-foreground">
                                            {transaction.user?.name || "Unknown User"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(transaction.createdAt).toLocaleDateString()}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-12 px-4">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium text-muted-foreground">No transaction history</p>
                    <p className="text-xs text-muted-foreground mt-1">Transactions will appear here as they occur</p>
                </div>
            )}
        </div>
    )
}