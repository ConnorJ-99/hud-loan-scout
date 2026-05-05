
function BorrowerFileCard({ loan, userId, canEdit, onLinked }: {
  loan: { id: string; borrower_file_id: string | null; borrower_name: string; borrower_email: string | null; borrower_phone: string | null; loan_amount: number | null; purchase_price: number | null; loan_type: string | null; assigned_lo: string | null };
  userId: string | undefined;
  canEdit: boolean;
  onLinked: () => void;
}) {
  const { data: bf } = useQuery({
    queryKey: ["ops-loan-borrower-file", loan.borrower_file_id],
    queryFn: async () => {
      if (!loan.borrower_file_id) return null;
      const { data } = await supabase.from("borrower_files").select("id, borrower_name, email, phone, status").eq("id", loan.borrower_file_id).maybeSingle();
      return data;
    },
    enabled: !!loan.borrower_file_id,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["ops-loan-borrower-candidates", loan.borrower_email, loan.borrower_phone, loan.borrower_name],
    queryFn: async () => {
      if (loan.borrower_file_id) return [];
      let q = supabase.from("borrower_files").select("id, borrower_name, email, phone").limit(5);
      if (loan.borrower_email) q = q.eq("email", loan.borrower_email);
      else if (loan.borrower_phone) q = q.eq("phone", loan.borrower_phone);
      else q = q.ilike("borrower_name", `%${loan.borrower_name}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const link = useMutation({
    mutationFn: async (bfId: string) => {
      const { error } = await supabase.from("loans").update({ borrower_file_id: bfId }).eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Borrower file linked"); onLinked(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase.from("borrower_files").insert({
        created_by: userId,
        borrower_name: loan.borrower_name,
        email: loan.borrower_email,
        phone: loan.borrower_phone,
        loan_amount: loan.loan_amount,
        purchase_price: loan.purchase_price,
        target_program: loan.loan_type,
        status: "active",
      }).select("id").single();
      if (error) throw error;
      const { error: linkErr } = await supabase.from("loans").update({ borrower_file_id: data.id }).eq("id", loan.id);
      if (linkErr) throw linkErr;
      return data.id;
    },
    onSuccess: () => { toast.success("Borrower file created and linked"); onLinked(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loans").update({ borrower_file_id: null }).eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Unlinked"); onLinked(); },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Borrower file</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {bf ? (
          <div className="space-y-2">
            <div className="rounded-md border border-border bg-panel/30 p-3">
              <div className="font-medium text-sm">{bf.borrower_name}</div>
              <div className="text-xs text-muted-foreground">{bf.email ?? "—"} • {bf.phone ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">Status: {bf.status}</div>
            </div>
            <div className="flex gap-2">
              <Link to={"/borrowers/$id" as never} params={{ id: bf.id } as never}
                className="text-xs px-3 py-1.5 rounded border border-cyan/40 text-cyan hover:bg-cyan/10">
                Open file
              </Link>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
                  Unlink
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">No borrower file linked.</div>
            {candidates.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Possible matches:</div>
                {candidates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded border border-border bg-panel/20 px-2 py-1.5">
                    <div className="text-xs">
                      <div className="font-medium">{c.borrower_name}</div>
                      <div className="text-muted-foreground">{c.email ?? c.phone ?? ""}</div>
                    </div>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => link.mutate(c.id)} disabled={link.isPending}>Link</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create new borrower file"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
