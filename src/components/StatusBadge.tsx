export const StatusBadge = ({ status, type = 'default' }: { status: string, type?: 'default' | 'dot' }) => {
    const statusClasses = {
        'Enquiry': 'bg-blue-100 text-blue-800', 'Quote Sent': 'bg-cyan-100 text-cyan-800',
        'Approved': 'bg-teal-100 text-teal-800', 'CAD': 'bg-indigo-100 text-indigo-800',
        'Casting': 'bg-purple-100 text-purple-800', 'Setting': 'bg-pink-100 text-pink-800',
        'Polishing': 'bg-orange-100 text-orange-800', 'Ready': 'bg-green-100 text-green-800',
        'Received': 'bg-gray-100 text-gray-800', 'Awaiting Approval': 'bg-yellow-100 text-yellow-800',
        'In Workshop': 'bg-blue-100 text-blue-800', 'Waiting Parts': 'bg-yellow-100 text-yellow-800',
        'Completed': 'bg-teal-100 text-teal-800', 'Ready for Pickup': 'bg-green-100 text-green-800',
        'Collected': 'bg-gray-200 text-gray-600', 'Active': 'bg-green-100 text-green-800',
        'Transferred': 'bg-blue-100 text-blue-800', 'VIP': 'bg-amber-100 text-amber-800',
        'Retail': 'bg-sky-100 text-sky-800', 'Bridal': 'bg-rose-100 text-rose-800',
        'In Stock': 'bg-green-100 text-green-800', 'Sold': 'bg-gray-100 text-gray-800',
        'Low Stock': 'bg-yellow-100 text-yellow-800',
    };

    const badgeClass = statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800';

    return (
        <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${badgeClass}\`}>
            {status}
        </span>
    )
}

export default StatusBadge;
