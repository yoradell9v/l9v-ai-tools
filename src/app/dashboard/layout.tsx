import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAccessToken } from "@/lib/core/auth";
import { prisma } from "@/lib/core/prisma";
import { UserProvider, User } from "@/context/UserContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

async function getDashboardData() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
        redirect("/signin");
    }

    try {
        const decoded = await verifyAccessToken(accessToken);
        if (!decoded) redirect("/signin");

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
                createdAt: true,
                globalRole: true,
            },
        });

        if (!user) redirect("/signin");

        const userData: User = {
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            createdAt: user.createdAt.toISOString(),
            globalRole: user.globalRole,
        };

        return userData;

    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        redirect("/signin");
    }
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getDashboardData();

    return (
        <UserProvider initialUser={user}>
            <SidebarProvider>
                <AppSidebar />
                <main className="flex-1">
                    {children}
                </main>
            </SidebarProvider>
        </UserProvider>
    );
}
