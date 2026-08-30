import { useState, useEffect, useMemo } from "react";
import {
  Download,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Loader2,
  TrendingUp,
  X,
  Check,
  Trash2,
} from "lucide-react";
import Style from "./AP_Invoice.module.css";
import api from "../../../components/api";
import { useNavigate } from "react-router";

const PAGE_SIZE = 5;

function currency(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(date) {
  if (!date) return "-";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(start, end) {
  if (!start || !end) return 0;

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
}

function getTodayISO() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function StatusBadge({ status }) {
  const normalized = String(status || "DRAFT").toUpperCase();

  let cls = `${Style.ivbadge} ${Style.ivbadgedraft}`;

  if (normalized === "PAID") {
    cls = `${Style.ivbadge} ${Style.ivbadgepaid}`;
  } else if (normalized === "PENDING") {
    cls = `${Style.ivbadge} ${Style.ivbadgepending}`;
  } else if (normalized === "APPROVED") {
    cls = `${Style.ivbadge} ${Style.ivbadgeapproved}`;
  }

  return <span className={cls}>{normalized}</span>;
}

export default function AP_Invoice() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("All Invoices");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const [showForm, setShowForm] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const [vendor, setVendor] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [invDate, setInvDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState(getDateAfterDays(30));
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("DRAFT");

  const getInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/ap_invoices");

      const data = res?.data?.ap_invoices;

      if (Array.isArray(data)) {
        setInvoices(data);
      } else {
        setInvoices([]);
        setError("Invalid invoice data returned by the server.");
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);

      setInvoices([]);

      setError(err?.response?.data?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getInvoices();
  }, []);

  const resetForm = () => {
    setVendor("");
    setVendorId("");
    setInvDate(getTodayISO());
    setDueDate(getDateAfterDays(30));
    setAmount("");
    setStatus("DRAFT");
  };

  const createInvoice = async (e) => {
    e.preventDefault();

    const trimmedVendor = vendor.trim();
    const numericAmount = Number(amount);

    if (!trimmedVendor) {
      setError("Vendor name is required.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    if (!invDate) {
      setError("Invoice date is required.");
      return;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    if (new Date(`${dueDate}T00:00:00`) < new Date(`${invDate}T00:00:00`)) {
      setError("Due date cannot be before invoice date.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        vendor_id: vendorId.trim() || undefined,
        invoice_date: invDate,
        due_date: dueDate,
        total_amount: numericAmount,
        status: status.toUpperCase(),
      };

      await api.post("/ap_invoices", payload);

      await getInvoices();

      resetForm();
      setShowForm(false);
      setPage(1);
    } catch (err) {
      console.error("Failed to create invoice:", err);

      setError(err?.response?.data?.message || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (id) => {
    if (!id) return;

    try {
      setSaving(true);
      setError("");

      await api.patch(`/ap_invoices/${id}`, {
        status: "PAID",
      });

      setInvoices((current) =>
        current.map((invoice) =>
          invoice._id === id
            ? {
                ...invoice,
                status: "PAID",
              }
            : invoice,
        ),
      );

      setMenuOpenId(null);
    } catch (err) {
      console.error("Failed to mark invoice as paid:", err);

      setError(
        err?.response?.data?.message || "Failed to mark invoice as paid.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteInvoice = async (id) => {
    if (!id) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this invoice?",
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await api.delete(`/ap_invoices/${id}`);

      setInvoices((current) => current.filter((invoice) => invoice._id !== id));

      setMenuOpenId(null);

      /*
       * If deleting the last item on a page,
       * move back one page when necessary.
       */
      setPage((currentPage) => {
        const remaining = invoices.length - 1;
        const newTotalPages = Math.max(1, Math.ceil(remaining / PAGE_SIZE));

        return Math.min(currentPage, newTotalPages);
      });
    } catch (err) {
      console.error("Failed to delete invoice:", err);

      setError(err?.response?.data?.message || "Failed to delete invoice.");
    } finally {
      setSaving(false);
    }
  };

  const filteredAll = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    let list = invoices.filter((invoice) => {
      if (!searchTerm) return true;

      const invoiceNumber = String(invoice?.invoice_number || "").toLowerCase();

      const vendorName = String(invoice?.vendor_id?.name || "").toLowerCase();

      const vendorNumber = String(
        invoice?.vendor_id?.Vendor_number || "",
      ).toLowerCase();

      return (
        invoiceNumber.includes(searchTerm) ||
        vendorName.includes(searchTerm) ||
        vendorNumber.includes(searchTerm)
      );
    });

    if (tab === "Pending") {
      list = list.filter(
        (invoice) => String(invoice?.status || "").toUpperCase() === "PENDING",
      );
    }

    if (tab === "Paid") {
      list = list.filter(
        (invoice) => String(invoice?.status || "").toUpperCase() === "PAID",
      );
    }

    list = [...list].sort((a, b) => {
      let value = 0;

      if (sortKey === "date") {
        value = new Date(a?.invoice_date || 0) - new Date(b?.invoice_date || 0);
      }

      if (sortKey === "amount") {
        value = Number(a?.total_amount || 0) - Number(b?.total_amount || 0);
      }

      return sortDir === "asc" ? value : -value;
    });

    return list;
  }, [invoices, search, tab, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE));

  const pageSafe = Math.min(Math.max(page, 1), totalPages);

  const pageItems = filteredAll.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );

  const totalOutstanding = invoices
    .filter((invoice) => String(invoice?.status || "").toUpperCase() !== "PAID")
    .reduce((sum, invoice) => sum + Number(invoice?.total_amount || 0), 0);

  const pendingList = invoices.filter(
    (invoice) => String(invoice?.status || "").toUpperCase() === "PENDING",
  );

  const pendingValue = pendingList.reduce(
    (sum, invoice) => sum + Number(invoice?.total_amount || 0),
    0,
  );

  const today = getTodayISO();
  const sevenDaysFromNow = getDateAfterDays(7);

  const dueThisWeek = invoices.filter((invoice) => {
    const statusValue = String(invoice?.status || "").toUpperCase();

    if (statusValue === "PAID") return false;

    if (!invoice?.due_date) return false;

    return invoice.due_date >= today && invoice.due_date <= sevenDaysFromNow;
  });

  const validInvoices = invoices.filter(
    (invoice) => invoice?.invoice_date && invoice?.due_date,
  );

  const avgCycle =
    validInvoices.length > 0
      ? (
          validInvoices.reduce(
            (sum, invoice) =>
              sum + daysBetween(invoice.invoice_date, invoice.due_date),
            0,
          ) / validInvoices.length
        ).toFixed(1)
      : "0.0";

  const dueBarPct = Math.min(
    100,
    Math.round(
      (dueThisWeek.length /
        Math.max(1, pendingList.length + dueThisWeek.length)) *
        100,
    ),
  );

  const exportCsv = () => {
    if (filteredAll.length === 0) {
      setError("There are no invoices to export.");
      return;
    }

    const header = [
      "Invoice #",
      "Vendor",
      "Vendor ID",
      "Date",
      "Due",
      "Amount",
      "Status",
    ];

    const rows = filteredAll.map((invoice) => [
      invoice?.invoice_number || "",
      invoice?.vendor_id?.name || "",
      invoice?.vendor_id?.Vendor_number || "",
      invoice?.invoice_date || "",
      invoice?.due_date || "",
      Number(invoice?.total_amount || 0).toFixed(2),
      String(invoice?.status || "").toUpperCase(),
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "invoices.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }

    setPage(1);
  };

  return (
    <main className={Style.ivcontent}>
      <div className={Style.ivpagehead}>
        <div>
          <h1 className={Style.ivpagetitle}>Invoices</h1>

          <p className={Style.ivpagesub}>
            Manage vendor billing and payment processing cycles.
          </p>
        </div>

        <div className={Style.ivheadactions}>
          <button
            className={Style.ivbtnghost}
            onClick={exportCsv}
            disabled={loading || saving}
          >
            <Download size={15} />
            EXPORT CSV
          </button>

          <button
            className={Style.ivbtnsolid}
            onClick={() => {
              setError("");
              setShowForm((current) => !current);
            }}
            disabled={saving}
          >
            <Plus size={15} />
            NEW INVOICE
          </button>
        </div>
      </div>

      <div className={Style.ivstatsgrid}>
        <div className={Style.ivstatcard}>
          <div className={Style.ivstatlabel}>Total Outstanding</div>

          <div className={Style.ivstatvalue}>{currency(totalOutstanding)}</div>

          <div className={Style.ivstattrend}>
            <TrendingUp size={13} />
            12% vs last month
          </div>
        </div>

        <div className={Style.ivstatcard}>
          <div className={Style.ivstatlabel}>Pending Approval</div>

          <div className={Style.ivstatvalue}>{pendingList.length}</div>

          <div className={Style.ivstattrend}>
            Valued at {currency(pendingValue)}
          </div>
        </div>

        <div className={Style.ivstatcard}>
          <div className={Style.ivstatlabel}>Due This Week</div>

          <div className={Style.ivstatvalue}>{dueThisWeek.length}</div>

          <div className={Style.ivprogresstrack}>
            <div
              className={Style.ivprogressfill}
              style={{
                width: `${dueBarPct}%`,
              }}
            />
          </div>
        </div>

        <div className={Style.ivstatcard}>
          <div className={Style.ivstatlabel}>Average Pay Cycle</div>

          <div className={Style.ivstatvalue}>{avgCycle} DAYS</div>

          <div className={Style.ivstatnote}>Target: 15.0 days</div>
        </div>
      </div>

      {showForm && (
        <div className={Style.ivformcard}>
          <div className={Style.ivformhead}>
            <span className={Style.ivformtitle}>New Invoice</span>

            <X
              size={18}
              className={Style.ivformclose}
              onClick={() => {
                resetForm();
                setShowForm(false);
                setError("");
              }}
            />
          </div>

          <form onSubmit={createInvoice}>
            <div className={Style.ivformgrid}>
              <div>
                <label className={Style.ivfieldlabel}>Vendor Name</label>

                <input
                  className={Style.ivinput}
                  placeholder="e.g. Nexus Logistics"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={Style.ivfieldlabel}>Vendor ID</label>

                <input
                  className={Style.ivinput}
                  placeholder="Vendor ID"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                />
              </div>

              <div>
                <label className={Style.ivfieldlabel}>Amount</label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={Style.ivinput}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={Style.ivformgrid}>
              <div>
                <label className={Style.ivfieldlabel}>Invoice Date</label>

                <input
                  type="date"
                  className={Style.ivinput}
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={Style.ivfieldlabel}>Due Date</label>

                <input
                  type="date"
                  className={Style.ivinput}
                  value={dueDate}
                  min={invDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={Style.ivfieldlabel}>Status</label>

                <select
                  className={Style.ivinput}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="DRAFT">Draft</option>

                  <option value="PENDING">Pending</option>

                  <option value="APPROVED">Approved</option>

                  <option value="PAID">Paid</option>
                </select>
              </div>
            </div>

            <div className={Style.ivformactions}>
              <button
                type="button"
                className={Style.ivbtncancel}
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                  setError("");
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={Style.ivbtnsave}
                disabled={saving || !vendor.trim() || !amount}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className={Style.ivspin} />
                    Saving...
                  </>
                ) : (
                  "Create Invoice"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={Style.ivtablecard}>
        <div className={Style.ivtabsrow}>
          <div className={Style.ivtabs}>
            {["All Invoices", "Pending", "Paid"].map((tabName) => (
              <button
                key={tabName}
                className={`${Style.ivtab} ${
                  tab === tabName ? Style.ivtabactive : ""
                }`}
                onClick={() => {
                  setTab(tabName);
                  setPage(1);
                  setMenuOpenId(null);
                }}
              >
                {tabName}
              </button>
            ))}
          </div>

          <div className={Style.ivtabletools}>
            <div
              className={`${Style.ivtoolbtn} ${
                sortKey === "date" ? Style.ivtoolactive : ""
              }`}
              onClick={() => handleSort("date")}
              title="Sort by date"
            >
              <Filter size={15} />
            </div>

            <div
              className={`${Style.ivtoolbtn} ${
                sortKey === "amount" ? Style.ivtoolactive : ""
              }`}
              onClick={() => handleSort("amount")}
              title="Sort by amount"
            >
              <ArrowUpDown size={15} />
            </div>
          </div>
        </div>

        {/* Search */}

        <div
          style={{
            padding: "0 20px 15px",
          }}
        >
          <input
            className={Style.ivinput}
            placeholder="Search invoice number, vendor, or vendor ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <table className={Style.ivtable}>
          <thead>
            <tr className={Style.ivtheadrow}>
              <th className={Style.ivth}>Invoice #</th>

              <th className={Style.ivth}>Vendor</th>

              <th className={Style.ivth}>Date</th>

              <th className={Style.ivth}>Due</th>

              <th className={Style.ivth}>Amount</th>

              <th className={Style.ivth}>Status</th>

              <th className={Style.ivth}>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className={Style.ivemptyrow}>
                <td colSpan={7}>
                  <Loader2 size={18} className={Style.ivspin} />
                  Loading invoices...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr className={Style.ivemptyrow}>
                <td colSpan={7}>No invoices match this view.</td>
              </tr>
            ) : (
              pageItems.map((invoice) => {
                const invoiceId = invoice?._id;

                const invoiceStatus = String(
                  invoice?.status || "",
                ).toUpperCase();

                return (
                  <tr key={invoiceId} className={Style.ivrow}>
                    <td className={`${Style.ivtd} ${Style.ivtdinvno}`}>
                      {invoice?.invoice_number}
                    </td>

                    <td className={Style.ivtd}>
                      <div className={Style.ivtdvendorcell}>
                        <div>
                          <div className={Style.ivvendorname}>
                            {invoice?.vendor_id?.name || "-"}
                          </div>

                          <div className={Style.ivvendorid}>
                            Vendor ID:{" "}
                            {invoice?.vendor_id?.Vendor_number || "-"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={`${Style.ivtd} ${Style.ivtddate}`}>
                      {formatDate(invoice?.invoice_date)}
                    </td>

                    <td className={`${Style.ivtd} ${Style.ivtddate}`}>
                      {formatDate(invoice?.due_date)}
                    </td>

                    <td className={`${Style.ivtd} ${Style.ivtdamount}`}>
                      {currency(invoice?.total_amount)}
                    </td>

                    <td className={Style.ivtd}>
                      <StatusBadge status={invoiceStatus} />
                    </td>

                    <td className={Style.ivtd}>
                      <div className={Style.ivrowmenuwrap}>
                        <MoreVertical
                          size={16}
                          className={Style.ivmenutrigger}
                          onClick={() =>
                            setMenuOpenId(
                              menuOpenId === invoiceId ? null : invoiceId,
                            )
                          }
                        />

                        {menuOpenId === invoiceId && (
                          <div className={Style.ivdropdown}>
                            <button
                              className={Style.ivdropdownitem}
                              onClick={() => {
                                setMenuOpenId(null);

                                navigate(`/Dashboard/AP_Lines/${invoiceId}`);
                              }}
                            >
                              <Plus size={14} />
                              Add Items
                            </button>

                            {invoiceStatus !== "PAID" && (
                              <button
                                className={Style.ivdropdownitem}
                                onClick={() => markPaid(invoiceId)}
                                disabled={saving}
                              >
                                <Check size={14} />
                                Mark as Paid
                              </button>
                            )}

                            <button
                              className={`${Style.ivdropdownitem} ${Style.ivdanger}`}
                              onClick={() => deleteInvoice(invoiceId)}
                              disabled={saving}
                            >
                              <Trash2 size={14} />
                              Delete Invoice
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className={Style.ivfooterrow}>
          <div className={Style.ivshowingtext}>
            Showing {pageItems.length} of {filteredAll.length} results
          </div>

          <div className={Style.ivpagination}>
            <button
              className={Style.ivpagebtn}
              disabled={pageSafe === 1}
              onClick={() => setPage(pageSafe - 1)}
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from(
              {
                length: totalPages,
              },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                className={`${Style.ivpagebtn} ${
                  pageNumber === pageSafe ? Style.ivpageactive : ""
                }`}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}

            <button
              className={Style.ivpagebtn}
              disabled={pageSafe === totalPages}
              onClick={() => setPage(pageSafe + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${Style.ivstatusbar} ${error ? Style.ivstatuserror : ""}`}
      >
        {saving
          ? "Saving changes..."
          : error
            ? error
            : "All changes are saved to the server."}
      </div>
    </main>
  );
}
