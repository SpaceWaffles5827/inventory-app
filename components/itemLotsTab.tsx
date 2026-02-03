"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PackageCheck, Plus, Calendar, AlertTriangle, Clock } from "lucide-react"
import { type LotWithRelations } from "@/lib/api/lots.api"

type LotStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED'

interface ItemLotsTabProps {
    itemId: string
    lots: LotWithRelations[]
    itemUnit?: string | null
    onCreateLot: () => void
    onNavigateToLot: (lotId: string) => void
}

export function ItemLotsTab({
    itemId,
    lots,
    itemUnit,
    onCreateLot,
    onNavigateToLot,
}: ItemLotsTabProps) {

    const getLotStatusBadge = (status: LotStatus) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-green-500">Active</Badge>
            case 'DEPLETED':
                return <Badge variant="secondary">Depleted</Badge>
            case 'EXPIRED':
                return <Badge variant="destructive">Expired</Badge>
            case 'QUARANTINED':
                return <Badge className="bg-yellow-500">Quarantined</Badge>
            case 'RECALLED':
                return <Badge variant="destructive">Recalled</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getDaysUntilExpiration = (expirationDate: string | null) => {
        if (!expirationDate) return null
        const now = new Date()
        const expDate = new Date(expirationDate)
        const diffTime = expDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    const getExpirationWarning = (expirationDate: string | null) => {
        const days = getDaysUntilExpiration(expirationDate)
        if (days === null) return null

        if (days < 0) return { color: 'text-red-600', text: 'Expired', icon: AlertTriangle }
        if (days <= 30) return { color: 'text-orange-500', text: `${days} days`, icon: AlertTriangle }
        if (days <= 60) return { color: 'text-yellow-600', text: `${days} days`, icon: Clock }
        return { color: 'text-muted-foreground', text: `${days} days`, icon: Calendar }
    }

    const sortedLots = [...lots].sort((a, b) => {
        if (a.expirationDate && b.expirationDate) {
            return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
        }
        if (a.expirationDate) return -1
        if (b.expirationDate) return 1
        return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()
    })

    return (
        <div className="bg-card p-4" data-testid="item-lots-tab">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-semibold">Lot / Batch Tracking</h3>
                    <p className="text-xs text-muted-foreground">Track inventory by production batch or lot number</p>
                </div>
                <Button onClick={onCreateLot} className="gap-2 h-8" data-testid="item-create-lot-button">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New Lot</span>
                </Button>
            </div>

            {lots.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed rounded-lg">
                    <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium text-muted-foreground">No lots created yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first lot to start tracking batches</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedLots.map((lot) => {
                        const expirationWarning = getExpirationWarning(lot.expirationDate)
                        const IconComponent = expirationWarning?.icon || Calendar

                        return (
                            <div
                                key={lot.id}
                                className="group p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 hover:border-accent/50 transition-all cursor-pointer"
                                onClick={() => onNavigateToLot(lot.id)}
                                data-testid={`item-lot-row-${lot.lotNumber.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-semibold font-mono text-sm">{lot.lotNumber}</h4>
                                            {getLotStatusBadge(lot.status as LotStatus)}
                                            {expirationWarning && lot.status === 'ACTIVE' && (
                                                <Badge variant="outline" className={`${expirationWarning.color} border-current text-xs`}>
                                                    <IconComponent className="h-2.5 w-2.5 mr-1" />
                                                    {expirationWarning.text}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                                            <div>
                                                <p className="text-muted-foreground">Quantity</p>
                                                <p className="font-semibold">{lot.quantity} / {lot.initialQuantity}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Received</p>
                                                <p className="font-semibold">{new Date(lot.receivedDate).toLocaleDateString()}</p>
                                            </div>
                                            {lot.expirationDate && (
                                                <div>
                                                    <p className="text-muted-foreground">Expires</p>
                                                    <p className="font-semibold">{new Date(lot.expirationDate).toLocaleDateString()}</p>
                                                </div>
                                            )}
                                            {lot.supplier && (
                                                <div>
                                                    <p className="text-muted-foreground">Supplier</p>
                                                    <p className="font-semibold truncate">{lot.supplier.name}</p>
                                                </div>
                                            )}
                                        </div>

                                        {lot.locations.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {lot.locations.map((loc) => (
                                                    <Badge key={loc.id} variant="secondary" className="text-xs font-mono">
                                                        {loc.locationCode}: {loc.quantity}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        {lot.notes && (
                                            <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{lot.notes}</p>
                                        )}
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <div className="text-2xl font-bold text-primary">
                                            {lot.quantity}
                                            {itemUnit && <span className="text-xs text-muted-foreground ml-1">{itemUnit}</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {Math.round((lot.quantity / lot.initialQuantity) * 100)}% remaining
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
