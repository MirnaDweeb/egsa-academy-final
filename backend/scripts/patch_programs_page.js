const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../frontend/src/features/admin/pages/admin/ProgramsPage.jsx');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Add Instructor State
const stateTarget = "  const [divisionFilter, setDivisionFilter] = useState(isSuperAdmin ? routeDivision || '' : currentDivision);\n  const [page, setPage] = useState(1);";
const stateReplacement = `  const [divisionFilter, setDivisionFilter] = useState(isSuperAdmin ? routeDivision || '' : currentDivision);
  const [instructorFilter, setInstructorFilter] = useState('');
  const [instructors, setInstructors] = useState([]);
  const [page, setPage] = useState(1);

  // Assign Instructor Modal State
  const [assigningProgram, setAssigningProgram] = useState(null);
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');`;

code = code.replace(stateTarget, stateReplacement);

// 2. Add assignedInstructor to formData in Create & Edit
code = code.replace(
  "    requiredEducation: '',\n  });",
  "    requiredEducation: '',\n    assignedInstructor: '',\n  });"
);

code = code.replace(
  "      requiredEducation: '',\n    });\n    setEditingProgramId(null);",
  "      requiredEducation: '',\n      assignedInstructor: '',\n    });\n    setEditingProgramId(null);"
);

code = code.replace(
  "      requiredEducation: prog.requiredEducation || '',\n    });\n    setEditingProgramId(prog.id || prog._id);",
  "      requiredEducation: prog.requiredEducation || '',\n      assignedInstructor: prog.assignedInstructor?._id || prog.assignedInstructor || (prog.assignedInstructors && prog.assignedInstructors[0]?._id) || (prog.assignedInstructors && prog.assignedInstructors[0]) || '',\n    });\n    setEditingProgramId(prog.id || prog._id);"
);

// 3. Load Instructors useEffect
const fetchTarget = "  const fetchPrograms = useCallback(async () => {";
const loadInstructorsCode = `  const loadInstructors = useCallback(async () => {
    try {
      const activeDiv = isSuperAdmin ? divisionFilter : currentDivision;
      const res = await adminService.listInstructors(activeDiv && activeDiv !== 'all' ? activeDiv : undefined);
      setInstructors(res.data?.instructors || res.instructors || res.data || []);
    } catch (_) {}
  }, [currentDivision, divisionFilter, isSuperAdmin]);

  useEffect(() => {
    loadInstructors();
  }, [loadInstructors]);

  const handleOpenAssignModal = (prog) => {
    setAssigningProgram(prog);
    const currId = prog.assignedInstructor?._id || prog.assignedInstructor || (prog.assignedInstructors && prog.assignedInstructors[0]?._id) || (prog.assignedInstructors && prog.assignedInstructors[0]) || '';
    setSelectedInstructorId(currId);
    setAssignReason('');
    setAssignError('');
    setAssignSuccess('');
  };

  const handleAssignInstructorSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedInstructorId) {
      setAssignError('Please select an instructor');
      return;
    }
    setAssignLoading(true);
    setAssignError('');
    setAssignSuccess('');
    try {
      await programService.assignInstructor(
        assigningProgram._id || assigningProgram.id,
        selectedInstructorId,
        assignReason.trim()
      );
      setAssignSuccess(\`Instructor assigned to \${assigningProgram.title} successfully!\`);
      fetchPrograms();
      setTimeout(() => {
        setAssigningProgram(null);
      }, 1000);
    } catch (err) {
      setAssignError(err.message || 'Failed to assign instructor');
    } finally {
      setAssignLoading(false);
    }
  };

  const fetchPrograms = useCallback(async () => {`;

code = code.replace(fetchTarget, loadInstructorsCode);

// 4. In fetchPrograms: add instructorId param and update dependencies
code = code.replace(
  "      if (statusFilter) params.status = statusFilter;",
  "      if (statusFilter) params.status = statusFilter;\n      if (instructorFilter) params.instructorId = instructorFilter;"
);

code = code.replace(
  "  }, [currentDivision, divisionFilter, isSuperAdmin, page, search, statusFilter]);",
  "  }, [currentDivision, divisionFilter, instructorFilter, isSuperAdmin, page, search, statusFilter]);"
);

// 5. Add Instructor column and update capacity column
const columnTarget = "  const columns = [\n    {\n      key: 'program',";
const instructorColumn = `  const columns = [
    {
      key: 'program',`;

const capacityTarget = `    {
      key: 'capacity',
      label: 'Capacity & Fee',
      render: (row) => (
        <div>
          <div className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
            <i className="fa-solid fa-users text-secondary me-1" aria-hidden="true"></i>
            {row.capacity} seats
          </div>
          <div className="text-secondary" style={{ fontSize: '0.78rem' }}>
            {row.price > 0 ? \`EGP \${row.price.toLocaleString()}\` : 'Free / Sponsored'}
          </div>
        </div>
      ),
    },`;

const updatedCapacityAndInstructor = `    {
      key: 'instructor',
      label: 'Assigned Instructor',
      render: (row) => {
        const inst = row.assignedInstructor || (row.assignedInstructors && row.assignedInstructors[0]);
        if (!inst) {
          return (
            <span className="badge bg-light text-muted border">
              <i className="fa-solid fa-user-xmark me-1" aria-hidden="true"></i>Unassigned
            </span>
          );
        }
        const name = typeof inst === 'object' ? (inst.fullName || inst.name) : 'Assigned';
        const email = typeof inst === 'object' ? inst.email : '';
        return (
          <div>
            <div className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
              <i className="fa-solid fa-user-astronaut text-primary me-1" aria-hidden="true"></i>
              {name}
            </div>
            {email && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{email}</div>}
          </div>
        );
      },
    },
    {
      key: 'capacity',
      label: 'Enrollment / Capacity',
      render: (row) => (
        <div>
          <div className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
            <i className="fa-solid fa-users text-secondary me-1" aria-hidden="true"></i>
            {row.enrolledCount !== undefined ? row.enrolledCount : (row.occupiedSeats || 0)} / {row.capacity} enrolled
          </div>
          <div className="text-secondary" style={{ fontSize: '0.78rem' }}>
            {row.price > 0 ? \`EGP \${row.price.toLocaleString()}\` : 'Free / Sponsored'}
          </div>
        </div>
      ),
    },`;

code = code.replace(capacityTarget, updatedCapacityAndInstructor);

// 6. Add Assign Instructor button in Actions
const actionBtnTarget = `<button
            type="button"
            className="btn btn-outline-info btn-sm"
            onClick={() => handleOpenEnrollments(row)}
            title="View program enrollments and capacity breakdown"
            id={\`btn-enrollments-\${row._id}\`}
          >
            <i className="fa-solid fa-users me-1" aria-hidden="true"></i> Enrollments
          </button>`;

const actionBtnReplacement = `<button
            type="button"
            className="btn btn-outline-info btn-sm"
            onClick={() => handleOpenEnrollments(row)}
            title="View program enrollments and capacity breakdown"
            id={\`btn-enrollments-\${row._id}\`}
          >
            <i className="fa-solid fa-users me-1" aria-hidden="true"></i> Enrollments
          </button>

          <button
            type="button"
            className="btn btn-outline-warning btn-sm"
            onClick={() => handleOpenAssignModal(row)}
            title="Assign or reassign course instructor"
            id={\`btn-assign-inst-\${row._id}\`}
          >
            <i className="fa-solid fa-user-plus me-1" aria-hidden="true"></i> Instructor
          </button>`;

code = code.replace(actionBtnTarget, actionBtnReplacement);

// 7. Add Instructor Filter in FilterBar
const filterBarTarget = `              {
                name: 'status',
                value: statusFilter,
                onChange: (val) => {
                  setStatusFilter(val);
                  setPage(1);
                },
                options: STATUS_OPTIONS,
              },`;

const filterBarReplacement = `              {
                name: 'status',
                value: statusFilter,
                onChange: (val) => {
                  setStatusFilter(val);
                  setPage(1);
                },
                options: STATUS_OPTIONS,
              },
              {
                name: 'instructor',
                value: instructorFilter,
                onChange: (val) => {
                  setInstructorFilter(val);
                  setPage(1);
                },
                options: [
                  { value: '', label: 'All Instructors' },
                  ...instructors.map((ins) => ({
                    value: ins.user?._id || ins._id || ins.id,
                    label: ins.user?.fullName || ins.fullName || ins.name || 'Instructor',
                  })),
                ],
              },`;

code = code.replace(filterBarTarget, filterBarReplacement);

// 8. Add Instructor selector in Create / Edit Modal (after category & transportation)
const modalFormTarget = `          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>
                Program Category
              </label>`;

const modalFormReplacement = `          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>
              Assigned Course Instructor
            </label>
            <select
              className="form-select"
              value={formData.assignedInstructor || ''}
              onChange={(e) => setFormData({ ...formData, assignedInstructor: e.target.value })}
            >
              <option value="">— Select Instructor (Optional / TBD) —</option>
              {instructors
                .filter((inst) => {
                  const instDiv = inst.user?.division || inst.division;
                  return isSuperAdmin || !instDiv || instDiv === formData.division;
                })
                .map((inst) => {
                  const instId = inst.user?._id || inst._id || inst.id;
                  const instName = inst.user?.fullName || inst.fullName || inst.name || 'Instructor';
                  const instEmail = inst.user?.email || inst.email || '';
                  return (
                    <option key={instId} value={instId}>
                      {instName} ({instEmail}) {inst.title ? \`— \${inst.title}\` : ''}
                    </option>
                  );
                })}
            </select>
            <div className="form-text" style={{ fontSize: '0.78rem' }}>
              Authoritative instructor assigned to lead this course and receive enrolled student cohorts.
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>
                Program Category
              </label>`;

code = code.replace(modalFormTarget, modalFormReplacement);

// 9. Add Assign Instructor Modal before the final closing div
const finalTarget = "      {/* Cancellation Confirmation Modal */}";
const assignModalCode = `      {/* Assign Instructor Modal */}
      {assigningProgram && (
        <Modal
          isOpen={Boolean(assigningProgram)}
          onClose={() => setAssigningProgram(null)}
          title={\`Assign Instructor: \${assigningProgram.title}\`}
          size="md"
          footer={
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAssigningProgram(null)}
                disabled={assignLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAssignInstructorSubmit}
                disabled={assignLoading || !selectedInstructorId}
              >
                {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          }
        >
          {assignError && <div className="alert alert-danger py-2 small mb-3">{assignError}</div>}
          {assignSuccess && <div className="alert alert-success py-2 small mb-3">{assignSuccess}</div>}

          <div className="mb-3">
            <div className="small text-muted mb-2">
              Course Division: <strong>{assigningProgram.division}</strong> | Current Enrolled: <strong>{assigningProgram.enrolledCount !== undefined ? assigningProgram.enrolledCount : assigningProgram.occupiedSeats || 0} students</strong>
            </div>

            <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>
              Select Active Instructor <span className="text-danger">*</span>
            </label>
            <select
              className="form-select"
              value={selectedInstructorId}
              onChange={(e) => setSelectedInstructorId(e.target.value)}
              disabled={assignLoading}
              required
            >
              <option value="">— Choose an instructor —</option>
              {instructors
                .filter((inst) => {
                  const instDiv = inst.user?.division || inst.division;
                  return isSuperAdmin || !instDiv || instDiv === assigningProgram.division;
                })
                .map((inst) => {
                  const instId = inst.user?._id || inst._id || inst.id;
                  const instName = inst.user?.fullName || inst.fullName || inst.name || 'Instructor';
                  const instEmail = inst.user?.email || inst.email || '';
                  return (
                    <option key={instId} value={instId}>
                      {instName} ({instEmail}) {inst.title ? \`— \${inst.title}\` : ''}
                    </option>
                  );
                })}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>
              Assignment Reason / Note (Optional)
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. Assigned for upcoming semester cohort training"
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              disabled={assignLoading}
            />
          </div>

          <div className="bg-light p-2.5 rounded border small text-muted">
            <i className="fa-solid fa-circle-info text-info me-1"></i>
            When an instructor is assigned or changed, the course and its student cohort roster are automatically updated in the Instructor Portal and Student Portal.
          </div>
        </Modal>
      )}

      {/* Cancellation Confirmation Modal */}`;

code = code.replace(finalTarget, assignModalCode);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully patched ProgramsPage.jsx');
