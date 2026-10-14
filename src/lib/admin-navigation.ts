export const adminGroups = [
  {
    "title": "홈",
    "owner": "공통",
    "items": [
      {
        "slug": "",
        "title": "대시보드",
        "description": "이벤트·신청·회원의 운영 현황을 확인합니다."
      }
    ]
  },
  {
    "title": "모집·이벤트 운영",
    "owner": "1조",
    "items": [
      {
        "slug": "events",
        "title": "이벤트 관리",
        "description": "이벤트 정보와 진행 상태를 관리합니다."
      },
      {
        "slug": "recruitment",
        "title": "모집 페이지",
        "description": "전체 이벤트에 연결된 공개 모집 페이지를 관리합니다."
      },
      {
        "slug": "messages",
        "title": "문자 발송",
        "description": "전체 이벤트의 안내 문자와 발송 내역을 관리합니다."
      },
      {
        "slug": "certificates",
        "title": "수료증 관리",
        "description": "공통 템플릿과 전체 발급 내역을 관리합니다."
      }
    ]
  },
  {
    "title": "내부 운영",
    "owner": "2조",
    "items": [
      {
        "slug": "resources",
        "title": "자료실",
        "description": "공통 자료와 전체 이벤트 자료를 모아 관리합니다."
      },
      {
        "slug": "schedule",
        "title": "스케줄",
        "description": "운영 일정과 담당 업무 일정을 확인합니다."
      },
      {
        "slug": "people",
        "title": "피플",
        "description": "운영진 프로필과 담당 업무를 관리합니다."
      },
      {
        "slug": "instagram",
        "title": "인스타그램 피드",
        "description": "공개할 인스타그램 콘텐츠를 관리합니다."
      },
      {
        "slug": "external-accounts",
        "title": "외부 서비스 계정",
        "description": "외부 서비스의 계정 정보와 담당자를 정리합니다. 비밀번호는 다루지 않습니다."
      },
      {
        "slug": "internal-board",
        "title": "내부 게시판",
        "description": "운영진의 공지와 업무 소통을 위한 공간입니다."
      },
      {
        "slug": "suggestions",
        "title": "건의함",
        "description": "운영 관련 의견과 건의 사항을 확인합니다."
      }
    ]
  },
  {
    "title": "홈페이지 관리",
    "owner": "3조",
    "items": [
      {
        "slug": "content",
        "title": "소개 콘텐츠",
        "description": "사용자 홈페이지에 공개할 소개와 참여 안내를 관리합니다."
      },
      {
        "slug": "matching",
        "title": "언어교환 매칭",
        "description": "언어교환 요청과 매칭 운영을 관리합니다."
      },
      {
        "slug": "member-board",
        "title": "회원 게시판",
        "description": "사용자 홈페이지의 회원 게시글을 관리합니다."
      },
      {
        "slug": "history",
        "title": "활동 히스토리",
        "description": "사용자 홈페이지에 공개할 지난 활동 기록을 관리합니다."
      }
    ]
  },
  {
    "title": "관리 설정",
    "owner": "공통",
    "items": [
      {
        "slug": "accounts",
        "title": "회원·운영진 계정",
        "description": "로그인 계정과 이용 상태를 확인합니다."
      },
      {
        "slug": "roles",
        "title": "역할·권한",
        "description": "접근 권한 설정을 위한 공간입니다. 현재는 기존 관리자 등록 기준을 유지합니다."
      },
      {
        "slug": "activity-log",
        "title": "활동 기록",
        "description": "운영 작업의 활동 내역을 확인합니다."
      }
    ]
  }
] as const;
export type AdminPageDefinition = { readonly slug: string; readonly title: string; readonly description: string };
export const adminPages: readonly AdminPageDefinition[] = adminGroups.flatMap<AdminPageDefinition>(group => group.items);
export const eventTabs = [
  {
    "slug": "overview",
    "title": "개요",
    "description": "이벤트 정보와 진행 상태"
  },
  {
    "slug": "recruitment",
    "title": "모집 페이지",
    "description": "해당 이벤트에 연결된 공개 페이지"
  },
  {
    "slug": "applicants",
    "title": "신청자",
    "description": "신청 정보와 선발"
  },
  {
    "slug": "attendance",
    "title": "참여자·출석",
    "description": "참여 확정과 회차별 출석"
  },
  {
    "slug": "messages",
    "title": "문자",
    "description": "해당 이벤트 대상 안내"
  },
  {
    "slug": "certificates",
    "title": "수료증",
    "description": "해당 이벤트 발급 내역"
  },
  {
    "slug": "resources",
    "title": "자료",
    "description": "해당 이벤트 관련 자료"
  }
] as const;
