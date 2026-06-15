import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App as AntdApp,
  Badge,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import type { BadgeProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { desktopApi } from './api/desktop-api';
import { AI_STATUS_LABELS, OUTPUT_STYLE_LABELS, PRIORITY_LABELS, TASK_STATUS_LABELS } from '@shared/constants';
import { getPeriodTitle, shiftBaseDate, todayString } from '@shared/date';
import type {
  AppInfo,
  AppSettings,
  CreateTaskInput,
  PeriodType,
  Priority,
  Project,
  TaskRecord,
  TaskStatus,
  UpdateSettingsInput,
  WeeklyReport
} from '@shared/types';

const { Sider, Content } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

type ViewKey = PeriodType | 'projects' | 'settings';

interface Filters {
  keyword: string;
  statuses: TaskStatus[];
  projectId: string | null;
}

interface QuickState {
  rawContent: string;
  status: TaskStatus;
  recordDate: string;
  projectId: string | null;
  tags: string[];
  priority: Priority | null;
}

const statusColor: Record<TaskStatus, string> = {
  completed: 'green',
  in_progress: 'blue',
  planned: 'gold',
  paused: 'default',
  canceled: 'red'
};

const aiColor: Record<TaskRecord['aiStatus'], NonNullable<BadgeProps['status']>> = {
  pending: 'default',
  generating: 'processing',
  succeeded: 'success',
  failed: 'error'
};

const projectColors = ['#237a57', '#2866b1', '#c77700', '#b6423b', '#6d5a3d', '#53645d'];

export default function App(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [view, setView] = useState<ViewKey>('week');
  const [baseDate, setBaseDate] = useState(todayString());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [polishingIds, setPolishingIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({ keyword: '', statuses: [], projectId: null });
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [quick, setQuick] = useState<QuickState>({
    rawContent: '',
    status: 'completed',
    recordDate: todayString(),
    projectId: null,
    tags: [],
    priority: null
  });
  const quickInputRef = useRef<TextAreaRef>(null);

  const weekStartDay = settings?.app.weekStartDay ?? 1;
  const isPeriodView = view !== 'settings' && view !== 'projects';

  const periodTitle = useMemo(() => {
    return isPeriodView ? getPeriodTitle(view, baseDate, weekStartDay) : view === 'projects' ? '项目' : '设置';
  }, [baseDate, isPeriodView, view, weekStartDay]);

  const loadSettings = useCallback(async () => {
    const next = await desktopApi.settings.getAll();
    setSettings(next);
    setQuick((current) => ({ ...current, status: current.status || next.task.defaultStatus }));
  }, []);

  const loadProjects = useCallback(async () => {
    setProjects(await desktopApi.projects.list());
  }, []);

  const loadTasks = useCallback(async () => {
    if (!isPeriodView) {
      return;
    }
    setLoading(true);
    try {
      const result = await desktopApi.tasks.list({
        periodType: view,
        baseDate,
        keyword: filters.keyword || undefined,
        statuses: filters.statuses.length ? filters.statuses : undefined,
        projectId: filters.projectId || undefined,
        limit: 500
      });
      setTasks(result.items);
      setTotal(result.total);
      setSelectedTaskIds((current) => current.filter((id) => result.items.some((task) => task.id === id)));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务加载失败');
    } finally {
      setLoading(false);
    }
  }, [baseDate, filters, isPeriodView, message, view]);

  useEffect(() => {
    void loadSettings();
    void loadProjects();
    desktopApi.app.getInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, [loadProjects, loadSettings]);

  useEffect(() => {
    return desktopApi.app.onFocusQuickInput(() => {
      setView('week');
      window.setTimeout(() => quickInputRef.current?.focus(), 80);
    });
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function createTask(polishAfterSave: boolean): Promise<void> {
    const rawContent = quick.rawContent.trim();
    if (!rawContent) {
      message.warning('请输入工作记录');
      return;
    }

    setSaving(true);
    try {
      const input: CreateTaskInput = {
        rawContent,
        status: quick.status,
        recordDate: quick.recordDate,
        projectId: quick.projectId,
        tags: quick.tags,
        priority: quick.priority
      };
      const created = await desktopApi.tasks.create(input);
      setQuick((current) => ({ ...current, rawContent: '', tags: [] }));
      message.success('已保存');

      if (polishAfterSave) {
        await polishTask(created.id);
      } else {
        await loadTasks();
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function polishTask(id: string): Promise<void> {
    setPolishingIds((current) => new Set(current).add(id));
    try {
      await desktopApi.tasks.polish(id);
      message.success('AI 优化完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'AI 优化失败');
    } finally {
      setPolishingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadTasks();
    }
  }

  async function removeTask(id: string): Promise<void> {
    await desktopApi.tasks.remove(id);
    message.success('已删除');
    await loadTasks();
  }

  async function batchPolishSelected(): Promise<void> {
    if (!selectedTaskIds.length) {
      message.warning('请先选择任务');
      return;
    }

    setBatchLoading(true);
    setPolishingIds((current) => new Set([...current, ...selectedTaskIds]));
    try {
      const result = await desktopApi.tasks.batchPolish(selectedTaskIds);
      message.success(`批量优化完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`);
      setSelectedTaskIds([]);
      await loadTasks();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批量优化失败');
    } finally {
      setBatchLoading(false);
      setPolishingIds((current) => {
        const next = new Set(current);
        for (const id of selectedTaskIds) {
          next.delete(id);
        }
        return next;
      });
    }
  }

  async function copySelectedTasks(): Promise<void> {
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(task.id));
    if (!selectedTasks.length) {
      message.warning('请先选择任务');
      return;
    }

    const text = selectedTasks.map((task) => `- ${task.polishedContent || task.rawContent}`).join('\n');
    await desktopApi.clipboard.writeText(text);
    message.success('已复制所选任务');
  }

  function confirmRemoveSelected(): void {
    if (!selectedTaskIds.length) {
      message.warning('请先选择任务');
      return;
    }

    Modal.confirm({
      title: `删除所选 ${selectedTaskIds.length} 条任务？`,
      content: '删除后不会出现在任务列表中。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await Promise.all(selectedTaskIds.map((id) => desktopApi.tasks.remove(id)));
        setSelectedTaskIds([]);
        message.success('已删除所选任务');
        await loadTasks();
      }
    });
  }

  async function generateReport(): Promise<void> {
    try {
      const weeklyReport = await desktopApi.reports.generateWeekly({ baseDate });
      setReport(weeklyReport);
      setReportOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '周报生成失败');
    }
  }

  const columns: ColumnsType<TaskRecord> = [
    {
      title: '日期',
      dataIndex: 'recordDate',
      width: 110
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: TaskStatus) => <Tag color={statusColor[status]}>{TASK_STATUS_LABELS[status]}</Tag>
    },
    {
      title: '任务条目',
      dataIndex: 'polishedContent',
      render: (_value, record) => (
        <div className="task-cell">
          <Text strong>{record.polishedContent || record.rawContent}</Text>
          {record.polishedContent && <Text type="secondary">{record.rawContent}</Text>}
          <Space size={[4, 4]} wrap>
            {record.projectName && <Tag color="geekblue">{record.projectName}</Tag>}
            {record.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {record.priority && <Tag color="volcano">{PRIORITY_LABELS[record.priority]}</Tag>}
          </Space>
        </div>
      )
    },
    {
      title: 'AI',
      dataIndex: 'aiStatus',
      width: 112,
      render: (aiStatus: TaskRecord['aiStatus'], record) => (
        <Tooltip title={record.aiError || record.aiModel || AI_STATUS_LABELS[aiStatus]}>
          <Badge status={polishingIds.has(record.id) ? 'processing' : aiColor[aiStatus]} text={polishingIds.has(record.id) ? '生成中' : AI_STATUS_LABELS[aiStatus]} />
        </Tooltip>
      )
    },
    {
      title: '操作',
      width: 150,
      render: (_value, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} size="small" onClick={() => setEditingTask(record)} />
          </Tooltip>
          <Tooltip title="AI 优化">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              loading={polishingIds.has(record.id)}
              onClick={() => void polishTask(record.id)}
            />
          </Tooltip>
          <Popconfirm title="删除这条记录？" okText="删除" cancelText="取消" onConfirm={() => void removeTask(record.id)}>
            <Tooltip title="删除">
              <Button icon={<DeleteOutlined />} danger size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const stats = useMemo(() => {
    return {
      completed: tasks.filter((task) => task.status === 'completed').length,
      inProgress: tasks.filter((task) => task.status === 'in_progress').length,
      planned: tasks.filter((task) => task.status === 'planned').length,
      aiFailed: tasks.filter((task) => task.aiStatus === 'failed').length
    };
  }, [tasks]);

  return (
    <Layout className="app-shell">
      <Sider width={218} className="app-sider">
        <div className="brand">
          <div className="brand-mark">周</div>
          <div>
            <Text className="brand-title">智能周报</Text>
            <Text className="brand-subtitle">Smart Weekly Report</Text>
          </div>
        </div>
        <Menu
          className="side-menu"
          mode="inline"
          selectedKeys={[view]}
          onClick={({ key }) => setView(key as ViewKey)}
          items={[
            { key: 'day', icon: <CalendarOutlined />, label: '今日' },
            { key: 'week', icon: <FileTextOutlined />, label: '本周' },
            { key: 'month', icon: <ClockCircleOutlined />, label: '本月' },
            { key: 'year', icon: <CheckCircleOutlined />, label: '本年' },
            { key: 'all', icon: <SearchOutlined />, label: '全部记录' },
            { key: 'projects', icon: <FolderOutlined />, label: '项目' },
            { key: 'settings', icon: <SettingOutlined />, label: '设置' }
          ]}
        />
      </Sider>

      <Content className="workspace">
        <header className="workspace-header">
          <div>
            <Title level={3}>{periodTitle}</Title>
            <Text type="secondary">{isPeriodView ? `${total} 条记录` : '本地优先，AI 辅助整理'}</Text>
          </div>
          {isPeriodView && (
            <Space>
              {view !== 'all' && (
                <>
                  <Button icon={<LeftOutlined />} onClick={() => setBaseDate(shiftBaseDate(view, baseDate, -1))} />
                  <Button onClick={() => setBaseDate(todayString())}>回到当前</Button>
                  <Button icon={<RightOutlined />} onClick={() => setBaseDate(shiftBaseDate(view, baseDate, 1))} />
                </>
              )}
              {view === 'week' && (
                <Button icon={<FileTextOutlined />} type="primary" onClick={() => void generateReport()}>
                  生成周报
                </Button>
              )}
            </Space>
          )}
        </header>

        {isPeriodView && (
          <>
            <QuickInput
              inputRef={quickInputRef}
              value={quick}
              projects={projects}
              saving={saving}
              onChange={setQuick}
              onSave={() => void createTask(false)}
              onSaveAndPolish={() => void createTask(true)}
            />
            <StatsStrip stats={stats} total={total} />
            <div className="toolbar">
              <Space wrap>
                <Input
                  allowClear
                  className="search-input"
                  prefix={<SearchOutlined />}
                  placeholder="搜索任务、项目"
                  value={filters.keyword}
                  onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                />
                <Select
                  allowClear
                  mode="multiple"
                  className="status-filter"
                  placeholder="状态"
                  value={filters.statuses}
                  onChange={(statuses) => setFilters((current) => ({ ...current, statuses }))}
                  options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                />
                <Select
                  allowClear
                  className="project-filter"
                  placeholder="项目"
                  value={filters.projectId}
                  onChange={(projectId) => setFilters((current) => ({ ...current, projectId }))}
                  options={projects.map((project) => ({ value: project.id, label: project.name }))}
                />
              </Space>
              <Space wrap>
                {selectedTaskIds.length > 0 && (
                  <>
                    <Tag color="green">已选 {selectedTaskIds.length} 条</Tag>
                    <Button icon={<ThunderboltOutlined />} loading={batchLoading} onClick={() => void batchPolishSelected()}>
                      批量优化
                    </Button>
                    <Button icon={<CopyOutlined />} onClick={() => void copySelectedTasks()}>
                      复制所选
                    </Button>
                    <Button icon={<DeleteOutlined />} danger onClick={confirmRemoveSelected}>
                      删除所选
                    </Button>
                  </>
                )}
                <Button icon={<ReloadOutlined />} onClick={() => void loadTasks()}>
                  刷新
                </Button>
              </Space>
            </div>
            <Table
              rowKey="id"
              className="task-table"
              columns={columns}
              dataSource={tasks}
              loading={loading}
              rowSelection={{
                selectedRowKeys: selectedTaskIds,
                onChange: (keys) => setSelectedTaskIds(keys.map(String))
              }}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无记录" /> }}
            />
          </>
        )}

        {view === 'settings' && settings && (
          <SettingsView
            settings={settings}
            onSaved={(next) => {
              setSettings(next);
              message.success('设置已保存');
            }}
            onDataRestored={async () => {
              await loadSettings();
              await loadProjects();
              message.success('数据已恢复');
            }}
            appInfo={appInfo}
          />
        )}

        {view === 'projects' && (
          <ProjectsView
            projects={projects}
            onCreate={() => setProjectModalOpen(true)}
            onRemove={async (id) => {
              await desktopApi.projects.remove(id);
              await loadProjects();
              message.success('项目已删除');
            }}
          />
        )}
      </Content>

      <TaskEditor
        task={editingTask}
        projects={projects}
        onClose={() => setEditingTask(null)}
        onSaved={async () => {
          setEditingTask(null);
          await loadTasks();
          message.success('任务已保存');
        }}
        onPolish={(id) => void polishTask(id)}
      />

      <ReportDrawer
        open={reportOpen}
        report={report}
        onClose={() => setReportOpen(false)}
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onCreated={async () => {
          setProjectModalOpen(false);
          await loadProjects();
          message.success('项目已创建');
        }}
      />
    </Layout>
  );
}

function QuickInput(props: {
  inputRef: RefObject<TextAreaRef>;
  value: QuickState;
  projects: Project[];
  saving: boolean;
  onChange: (value: QuickState) => void;
  onSave: () => void;
  onSaveAndPolish: () => void;
}): JSX.Element {
  const { inputRef, value, projects, saving, onChange, onSave, onSaveAndPolish } = props;

  return (
    <section className="quick-input">
      <TextArea
        ref={inputRef}
        value={value.rawContent}
        onChange={(event) => onChange({ ...value, rawContent: event.target.value })}
        onPressEnter={(event) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onSaveAndPolish();
          }
        }}
        placeholder="记录一件事"
        autoSize={{ minRows: 3, maxRows: 5 }}
      />
      <Flex className="quick-actions" gap={10} wrap="wrap" justify="space-between">
        <Space wrap>
          <Select
            className="quick-select"
            value={value.status}
            onChange={(status) => onChange({ ...value, status })}
            options={Object.entries(TASK_STATUS_LABELS).map(([status, label]) => ({ value: status, label }))}
          />
          <DatePicker
            value={dayjs(value.recordDate)}
            onChange={(date) => onChange({ ...value, recordDate: (date ?? dayjs()).format('YYYY-MM-DD') })}
          />
          <Select
            allowClear
            className="quick-select"
            placeholder="项目"
            value={value.projectId}
            onChange={(projectId) => onChange({ ...value, projectId })}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
          <Select
            allowClear
            className="quick-select"
            placeholder="优先级"
            value={value.priority}
            onChange={(priority) => onChange({ ...value, priority })}
            options={Object.entries(PRIORITY_LABELS).map(([priority, label]) => ({ value: priority, label }))}
          />
          <Select
            mode="tags"
            className="tag-input"
            placeholder="标签"
            value={value.tags}
            onChange={(tags) => onChange({ ...value, tags })}
          />
        </Space>
        <Space>
          <Button icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            保存
          </Button>
          <Button icon={<ThunderboltOutlined />} type="primary" loading={saving} onClick={onSaveAndPolish}>
            保存并优化
          </Button>
        </Space>
      </Flex>
    </section>
  );
}

function StatsStrip(props: {
  total: number;
  stats: {
    completed: number;
    inProgress: number;
    planned: number;
    aiFailed: number;
  };
}): JSX.Element {
  const items = [
    { label: '总记录', value: props.total, tone: 'ink' },
    { label: '已完成', value: props.stats.completed, tone: 'green' },
    { label: '进行中', value: props.stats.inProgress, tone: 'blue' },
    { label: '计划中', value: props.stats.planned, tone: 'amber' },
    { label: 'AI 失败', value: props.stats.aiFailed, tone: 'red' }
  ];

  return (
    <section className="stats-strip">
      {items.map((item) => (
        <div className={`stat-card stat-${item.tone}`} key={item.label}>
          <Text type="secondary">{item.label}</Text>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}

function TaskEditor(props: {
  task: TaskRecord | null;
  projects: Project[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onPolish: (id: string) => void;
}): JSX.Element {
  const { task, projects, onClose, onSaved, onPolish } = props;
  const [form] = Form.useForm();

  useEffect(() => {
    if (task) {
      form.setFieldsValue({
        rawContent: task.rawContent,
        polishedContent: task.polishedContent,
        status: task.status,
        recordDate: dayjs(task.recordDate),
        projectId: task.projectId,
        tags: task.tags,
        priority: task.priority
      });
    }
  }, [form, task]);

  async function save(): Promise<void> {
    if (!task) {
      return;
    }
    const values = await form.validateFields();
    await desktopApi.tasks.update(task.id, {
      rawContent: values.rawContent,
      polishedContent: values.polishedContent || null,
      status: values.status,
      recordDate: (values.recordDate as Dayjs).format('YYYY-MM-DD'),
      projectId: values.projectId ?? null,
      tags: values.tags ?? [],
      priority: values.priority ?? null
    });
    await onSaved();
  }

  return (
    <Drawer
      title="编辑任务"
      width={560}
      open={Boolean(task)}
      onClose={onClose}
      extra={
        task && (
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => onPolish(task.id)}>
              AI 优化
            </Button>
            <Button icon={<SaveOutlined />} type="primary" onClick={() => void save()}>
              保存
            </Button>
          </Space>
        )
      }
    >
      {task && (
        <Form form={form} layout="vertical">
          <Form.Item name="rawContent" label="原始记录" rules={[{ required: true, message: '原始记录不能为空' }]}>
            <TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
          </Form.Item>
          <Form.Item name="polishedContent" label="周报条目">
            <TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item className="form-flex" name="status" label="状态" rules={[{ required: true }]}>
              <Select options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item className="form-flex" name="recordDate" label="日期" rules={[{ required: true }]}>
              <DatePicker className="full-width" />
            </Form.Item>
          </Flex>
          <Form.Item name="projectId" label="项目">
            <Select
              allowClear
              options={projects.map((project) => ({ value: project.id, label: project.name }))}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select
              allowClear
              options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <div className="ai-note">
            <Badge status={aiColor[task.aiStatus]} text={AI_STATUS_LABELS[task.aiStatus]} />
            {task.aiError && <Text type="danger">{task.aiError}</Text>}
          </div>
        </Form>
      )}
    </Drawer>
  );
}

function SettingsView(props: {
  settings: AppSettings;
  onSaved: (settings: AppSettings) => void;
  onDataRestored: () => Promise<void>;
  appInfo: AppInfo | null;
}): JSX.Element {
  const { settings, onSaved, onDataRestored, appInfo } = props;
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [databasePath, setDatabasePath] = useState('');

  useEffect(() => {
    form.setFieldsValue({
      ai: {
        ...settings.ai,
        apiKey: ''
      },
      app: settings.app,
      task: settings.task,
      report: settings.report
    });
  }, [form, settings]);

  useEffect(() => {
    desktopApi.data
      .getDatabasePath()
      .then((result) => setDatabasePath(result.path))
      .catch(() => setDatabasePath(''));
  }, []);

  function normalizeValues(raw: UpdateSettingsInput): UpdateSettingsInput {
    const next = structuredClone(raw);
    if (next.ai?.apiKey !== undefined && !next.ai.apiKey.trim()) {
      delete next.ai.apiKey;
    }
    if (next.ai?.temperature !== undefined) {
      next.ai.temperature = Number(next.ai.temperature);
    }
    if (next.ai?.maxTokens !== undefined) {
      next.ai.maxTokens = Number(next.ai.maxTokens);
    }
    if (next.ai?.timeoutMs !== undefined) {
      next.ai.timeoutMs = Number(next.ai.timeoutMs);
    }
    if (next.app?.weekStartDay !== undefined) {
      next.app.weekStartDay = Number(next.app.weekStartDay);
    }
    return next;
  }

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const values = normalizeValues(await form.validateFields());
      const next = await desktopApi.settings.update(values);
      onSaved(next);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '设置保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(): Promise<void> {
    setTesting(true);
    try {
      const values = normalizeValues(await form.validateFields());
      const result = await desktopApi.settings.testAiConnection(values.ai);
      if (result.success) {
        Modal.success({ title: result.message, content: result.sample });
      } else {
        Modal.error({ title: '连接失败', content: result.message });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '连接测试失败');
    } finally {
      setTesting(false);
    }
  }

  async function backupData(): Promise<void> {
    setDataBusy(true);
    try {
      const result = await desktopApi.data.backup();
      if (result.success) {
        message.success(`备份完成：${result.filePath}`);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '备份失败');
    } finally {
      setDataBusy(false);
    }
  }

  function restoreData(): void {
    Modal.confirm({
      title: '恢复数据？',
      content: '恢复会替换当前本地数据库。建议先备份当前数据。',
      okText: '选择备份并恢复',
      cancelText: '取消',
      onOk: async () => {
        setDataBusy(true);
        try {
          const result = await desktopApi.data.restore();
          if (result.success) {
            await onDataRestored();
          }
        } catch (error) {
          message.error(error instanceof Error ? error.message : '恢复失败');
        } finally {
          setDataBusy(false);
        }
      }
    });
  }

  return (
    <section className="settings-panel">
      <Form form={form} layout="vertical">
        <div className="settings-section">
          <Title level={4}>AI 配置</Title>
          <Form.Item name={['ai', 'baseUrl']} label="API Base URL" rules={[{ required: true, message: '请输入 API 地址' }]}>
            <Input placeholder="https://api.example.com" />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item className="form-flex" name={['ai', 'model']} label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
              <Input placeholder="gpt-4o-mini" />
            </Form.Item>
            <Form.Item className="form-flex" name={['ai', 'apiKey']} label={`API Key${settings.ai.hasApiKey ? `（当前：${settings.ai.apiKeyMasked}）` : ''}`}>
              <Input.Password placeholder="留空则保持当前密钥" />
            </Form.Item>
          </Flex>
          <Flex gap={12}>
            <Form.Item className="form-flex" name={['ai', 'temperature']} label="Temperature">
              <Input type="number" step="0.1" min="0" max="2" />
            </Form.Item>
            <Form.Item className="form-flex" name={['ai', 'maxTokens']} label="Max Tokens">
              <Input type="number" min="50" max="4000" />
            </Form.Item>
            <Form.Item className="form-flex" name={['ai', 'timeoutMs']} label="超时毫秒">
              <Input type="number" min="5000" />
            </Form.Item>
            <Form.Item className="form-flex" name={['ai', 'outputStyle']} label="输出风格">
              <Select options={Object.entries(OUTPUT_STYLE_LABELS).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          </Flex>
        </div>

        <div className="settings-section">
          <Title level={4}>偏好</Title>
          <Flex gap={12}>
            <Form.Item className="form-flex" name={['app', 'weekStartDay']} label="每周起始日">
              <Select
                options={[
                  { value: 1, label: '周一' },
                  { value: 0, label: '周日' }
                ]}
              />
            </Form.Item>
            <Form.Item className="form-flex" name={['task', 'defaultStatus']} label="默认任务状态">
              <Select options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          </Flex>
        </div>

        <div className="settings-section">
          <Title level={4}>周报模板</Title>
          <Form.Item name={['report', 'weeklyTemplate']}>
            <TextArea autoSize={{ minRows: 10, maxRows: 18 }} />
          </Form.Item>
        </div>

        <div className="settings-section">
          <Title level={4}>数据管理</Title>
          <div className="database-path">
            <DatabaseOutlined />
            <Text copyable>{databasePath || '正在读取数据库位置'}</Text>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} loading={dataBusy} onClick={() => void backupData()}>
              备份数据
            </Button>
            <Button icon={<UploadOutlined />} loading={dataBusy} onClick={restoreData}>
              恢复数据
            </Button>
          </Space>
        </div>

        <div className="settings-section app-info-section">
          <Title level={4}>应用信息</Title>
          <div className="info-row">
            <Text type="secondary">名称</Text>
            <Text>{appInfo?.name ?? '周报任务记录工具'}</Text>
          </div>
          <div className="info-row">
            <Text type="secondary">版本</Text>
            <Text>{appInfo?.version ?? '-'}</Text>
          </div>
        </div>

        <Space>
          <Button icon={<ThunderboltOutlined />} loading={testing} onClick={() => void testConnection()}>
            测试连接
          </Button>
          <Button icon={<SaveOutlined />} type="primary" loading={saving} onClick={() => void save()}>
            保存设置
          </Button>
        </Space>
      </Form>
    </section>
  );
}

function ProjectsView(props: { projects: Project[]; onCreate: () => void; onRemove: (id: string) => Promise<void> }): JSX.Element {
  const { projects, onCreate, onRemove } = props;

  return (
    <section className="projects-panel">
      <div className="panel-heading">
        <Title level={4}>项目列表</Title>
        <Button icon={<FolderOutlined />} type="primary" onClick={onCreate}>
          新建项目
        </Button>
      </div>
      <div className="project-grid">
        {projects.map((project, index) => (
          <div className="project-item" key={project.id}>
            <div className="project-color" style={{ backgroundColor: project.color || projectColors[index % projectColors.length] }} />
            <div className="project-main">
              <Text strong>{project.name}</Text>
              <Text type="secondary">{project.description || '无描述'}</Text>
            </div>
            <Popconfirm title="删除这个项目？" okText="删除" cancelText="取消" onConfirm={() => void onRemove(project.id)}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        ))}
        {!projects.length && <Empty description="暂无项目" />}
      </div>
    </section>
  );
}

function ProjectModal(props: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }): JSX.Element {
  const { open, onClose, onCreated } = props;
  const [form] = Form.useForm();

  async function create(): Promise<void> {
    const values = await form.validateFields();
    await desktopApi.projects.create(values);
    form.resetFields();
    await onCreated();
  }

  return (
    <Modal title="新建项目" open={open} onCancel={onClose} onOk={() => void create()} okText="创建" cancelText="取消">
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
        </Form.Item>
        <Form.Item name="color" label="颜色">
          <Select
            options={projectColors.map((color) => ({
              value: color,
              label: <span className="color-option"><span style={{ backgroundColor: color }} />{color}</span>
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ReportDrawer(props: { open: boolean; report: WeeklyReport | null; onClose: () => void }): JSX.Element {
  const { open, report, onClose } = props;
  const { message } = AntdApp.useApp();

  async function copy(): Promise<void> {
    if (!report) {
      return;
    }
    await desktopApi.clipboard.writeText(report.content);
    message.success('已复制');
  }

  async function exportMarkdown(): Promise<void> {
    if (!report) {
      return;
    }
    const result = await desktopApi.reports.exportMarkdown({
      defaultFileName: `周报_${report.startDate}_${report.endDate}.md`,
      content: report.content
    });
    if (result.success) {
      message.success(`已导出：${result.filePath}`);
    }
  }

  return (
    <Drawer
      title={report?.title ?? '周报'}
      width={640}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button icon={<CopyOutlined />} onClick={() => void copy()}>
            复制
          </Button>
          <Button icon={<ExportOutlined />} type="primary" onClick={() => void exportMarkdown()}>
            导出 Markdown
          </Button>
        </Space>
      }
    >
      <TextArea value={report?.content ?? ''} autoSize={{ minRows: 24, maxRows: 36 }} />
    </Drawer>
  );
}
